"""Stock-photo providers. The only module that talks to the network.

The client only ever names a provider and a photo id. The download URL is resolved from the provider's
API and must stay on that provider's image CDN over https for every hop (redirects are followed manually
and re-checked), so a hostile response or client can never aim the server at an arbitrary host.
"""

from __future__ import annotations

import logging
import re
import time
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import requests
from django.conf import settings

API_TIMEOUT = (3.05, 10)
DOWNLOAD_TIMEOUT = (3.05, 10)
DOWNLOAD_DEADLINE_SECONDS = 25.0
MAX_REDIRECTS = 3
MAX_PER_PAGE = 30
USER_AGENT = "Doory-StockProxy/1.0"
UTM = {"utm_source": "doory", "utm_medium": "referral"}
_REDIRECT_CODES = frozenset({301, 302, 303, 307, 308})
_UNSAFE_URL_CHARS = re.compile(r"[\x00-\x20\x7f-\uffff\\]")
_UNSPLASH_ID = re.compile(r"[A-Za-z0-9_-]{5,40}")
_PEXELS_ID = re.compile(r"[0-9]{1,12}")

logger = logging.getLogger(__name__)

http_get: Callable[..., Any] = requests.get


class ProviderError(Exception):
    """The provider failed, answered nonsense, or pointed somewhere it must not."""


class PhotoTooLarge(ProviderError):
    """The photo exceeds the download cap."""


@dataclass(frozen=True)
class StockPhoto:
    id: str
    provider: str
    thumb_url: str
    preview_url: str
    width: int
    height: int
    author: str
    author_url: str
    source_url: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "provider": self.provider,
            "thumb_url": self.thumb_url,
            "preview_url": self.preview_url,
            "width": self.width,
            "height": self.height,
            "author": self.author,
            "author_url": self.author_url,
            "source_url": self.source_url,
        }


@dataclass(frozen=True)
class SearchPage:
    total: int
    next_page: int | None
    photos: list[StockPhoto]


@dataclass(frozen=True)
class ResolvedPhoto:
    photo: StockPhoto
    download_url: str
    track_url: str | None = None


def check_https_host(url: str, hosts: frozenset[str]) -> str:
    """Return `url` unchanged when it is plain https on an allow-listed host, else raise ProviderError."""
    if _UNSAFE_URL_CHARS.search(url):
        raise ProviderError("URL contains unsafe characters.")
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as exc:
        raise ProviderError("Malformed URL from provider.") from exc
    if (
        parts.scheme != "https"
        or parts.hostname not in hosts
        or parts.username is not None
        or parts.password is not None
        or port not in (None, 443)
    ):
        raise ProviderError("URL is not on an allowed host.")
    return url


def _https_link(value: object) -> str:
    """A link rendered as an anchor in the UI: https only, otherwise dropped."""
    if not isinstance(value, str) or _UNSAFE_URL_CHARS.search(value):
        return ""
    try:
        return value if urlsplit(value).scheme == "https" else ""
    except ValueError:
        return ""


def _with_query(url: str, extra: dict[str, str]) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(extra)
    return urlunsplit(parts._replace(query=urlencode(query)))


def _dict(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _is_count(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _as_int(value: object, default: int = 0) -> int:
    return value if _is_count(value) else default


def _as_str(value: object, limit: int = 200) -> str:
    return value[:limit] if isinstance(value, str) else ""


def _get_json(url: str, *, headers: dict[str, str], params: dict[str, Any] | None = None) -> Any:
    try:
        response = http_get(
            url,
            params=params,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json", **headers},
            timeout=API_TIMEOUT,
            allow_redirects=False,
        )
    except requests.RequestException as exc:
        raise ProviderError("Provider request failed.") from exc
    try:
        if response.status_code != 200:
            raise ProviderError(f"Provider answered {response.status_code}.")
        return response.json()
    except ValueError as exc:
        raise ProviderError("Provider returned invalid JSON.") from exc
    finally:
        response.close()


def _next_page(total: int, page: int, per_page: int) -> int | None:
    return page + 1 if page * per_page < total else None


class StockProvider(ABC):
    name: str
    image_hosts: frozenset[str]

    @property
    def configured(self) -> bool:
        return bool(self._key())

    @abstractmethod
    def _key(self) -> str: ...

    @abstractmethod
    def valid_id(self, photo_id: str) -> bool: ...

    @abstractmethod
    def search(self, query: str, page: int, per_page: int) -> SearchPage: ...

    @abstractmethod
    def resolve(self, photo_id: str) -> ResolvedPhoto: ...

    @abstractmethod
    def _headers(self) -> dict[str, str]: ...

    def track_download(self, resolved: ResolvedPhoto) -> None:
        """Report a download to providers that require it (they set `track_url`); never fails the import."""
        if not resolved.track_url:
            return
        try:
            _get_json(resolved.track_url, headers=self._headers())
        except ProviderError:
            logger.warning("Could not report a %s download.", self.name)

    def _checked(self, url: object) -> str | None:
        try:
            return check_https_host(url, self.image_hosts) if isinstance(url, str) else None
        except ProviderError:
            return None


class UnsplashProvider(StockProvider):
    name = "unsplash"
    image_hosts = frozenset({"images.unsplash.com"})
    api_hosts = frozenset({"api.unsplash.com"})
    api = "https://api.unsplash.com"

    def _key(self) -> str:
        return settings.UNSPLASH_ACCESS_KEY

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Client-ID {self._key()}", "Accept-Version": "v1"}

    def valid_id(self, photo_id: str) -> bool:
        return _UNSPLASH_ID.fullmatch(photo_id) is not None

    def _photo(self, item: object) -> StockPhoto | None:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            return None
        urls, user, links = _dict(item.get("urls")), _dict(item.get("user")), _dict(item.get("links"))
        user_links = _dict(user.get("links"))
        thumb, preview = self._checked(urls.get("small")), self._checked(urls.get("regular"))
        if not thumb or not preview or not self.valid_id(item["id"]):
            return None
        author_url, source_url = _https_link(user_links.get("html")), _https_link(links.get("html"))
        return StockPhoto(
            id=item["id"],
            provider=self.name,
            thumb_url=thumb,
            preview_url=preview,
            width=_as_int(item.get("width")),
            height=_as_int(item.get("height")),
            author=_as_str(user.get("name")),
            author_url=_with_query(author_url, UTM) if author_url else "",
            source_url=_with_query(source_url, UTM) if source_url else "",
        )

    def search(self, query: str, page: int, per_page: int) -> SearchPage:
        params: dict[str, Any] = {"page": page, "per_page": per_page}
        if query:
            data = _get_json(
                f"{self.api}/search/photos", headers=self._headers(), params={**params, "query": query}
            )
            if not isinstance(data, dict) or not isinstance(data.get("results"), list):
                raise ProviderError("Unexpected provider response.")
            total = _as_int(data.get("total"))
            return SearchPage(total, _next_page(total, page, per_page), self._photos(data["results"]))
        data = _get_json(f"{self.api}/photos", headers=self._headers(), params=params)
        if not isinstance(data, list):
            raise ProviderError("Unexpected provider response.")
        more = page + 1 if len(data) == per_page else None
        return SearchPage((page - 1) * per_page + len(data), more, self._photos(data))

    def _photos(self, items: list[Any]) -> list[StockPhoto]:
        return [photo for photo in map(self._photo, items) if photo]

    def resolve(self, photo_id: str) -> ResolvedPhoto:
        data = _get_json(f"{self.api}/photos/{photo_id}", headers=self._headers())
        photo = self._photo(data)
        if photo is None:
            raise ProviderError("Unexpected provider response.")
        urls, links = _dict(data.get("urls")), _dict(data.get("links"))
        raw = self._checked(urls.get("raw"))
        download = _with_query(raw, {"w": "2400", "q": "85", "fm": "jpg", "fit": "max"}) if raw else None
        download = download or self._checked(urls.get("regular"))
        if not download:
            raise ProviderError("The provider gave no downloadable image.")
        track = links.get("download_location")
        try:
            track_url = check_https_host(track, self.api_hosts) if isinstance(track, str) else None
        except ProviderError:
            track_url = None
        return ResolvedPhoto(photo=photo, download_url=download, track_url=track_url)


class PexelsProvider(StockProvider):
    name = "pexels"
    image_hosts = frozenset({"images.pexels.com"})
    api = "https://api.pexels.com/v1"

    def _key(self) -> str:
        return settings.PEXELS_API_KEY

    def _headers(self) -> dict[str, str]:
        return {"Authorization": self._key()}

    def valid_id(self, photo_id: str) -> bool:
        return _PEXELS_ID.fullmatch(photo_id) is not None

    def _photo(self, item: object) -> StockPhoto | None:
        if not isinstance(item, dict) or not _is_count(item.get("id")):
            return None
        src = _dict(item.get("src"))
        thumb, preview = self._checked(src.get("medium")), self._checked(src.get("large"))
        if not thumb or not preview:
            return None
        return StockPhoto(
            id=str(item["id"]),
            provider=self.name,
            thumb_url=thumb,
            preview_url=preview,
            width=_as_int(item.get("width")),
            height=_as_int(item.get("height")),
            author=_as_str(item.get("photographer")),
            author_url=_https_link(item.get("photographer_url")),
            source_url=_https_link(item.get("url")),
        )

    def search(self, query: str, page: int, per_page: int) -> SearchPage:
        params: dict[str, Any] = {"page": page, "per_page": per_page}
        if query:
            data = _get_json(f"{self.api}/search", headers=self._headers(), params={**params, "query": query})
        else:
            data = _get_json(f"{self.api}/curated", headers=self._headers(), params=params)
        if not isinstance(data, dict) or not isinstance(data.get("photos"), list):
            raise ProviderError("Unexpected provider response.")
        photos = [photo for photo in map(self._photo, data["photos"]) if photo]
        if "total_results" in data:
            total = _as_int(data["total_results"])
            return SearchPage(total, _next_page(total, page, per_page), photos)
        more = page + 1 if data.get("next_page") else None
        return SearchPage((page - 1) * per_page + len(data["photos"]), more, photos)

    def resolve(self, photo_id: str) -> ResolvedPhoto:
        data = _get_json(f"{self.api}/photos/{photo_id}", headers=self._headers())
        photo = self._photo(data)
        if photo is None:
            raise ProviderError("Unexpected provider response.")
        src = _dict(data.get("src"))
        download = self._checked(src.get("large2x")) or self._checked(src.get("original"))
        if not download:
            raise ProviderError("The provider gave no downloadable image.")
        return ResolvedPhoto(photo=photo, download_url=download)


PROVIDERS: dict[str, StockProvider] = {p.name: p for p in (UnsplashProvider(), PexelsProvider())}


def configured_providers() -> list[StockProvider]:
    return [provider for provider in PROVIDERS.values() if provider.configured]


def _redirect_target(current: str, location: str, hosts: frozenset[str]) -> str:
    try:
        return check_https_host(urljoin(current, location), hosts)
    except ValueError as exc:
        raise ProviderError("Malformed redirect target.") from exc


def _stream(response: Any, deadline: float) -> Iterator[bytes]:
    for chunk in response.iter_content(chunk_size=64 * 1024):
        if time.monotonic() > deadline:
            raise ProviderError("The download took too long.")
        yield chunk


def download_image(url: str, *, hosts: frozenset[str], max_bytes: int) -> bytes:
    """Fetch `url` (https, allow-listed host on every redirect hop) with a byte cap and a deadline."""
    deadline = time.monotonic() + DOWNLOAD_DEADLINE_SECONDS
    current = check_https_host(url, hosts)
    for _ in range(MAX_REDIRECTS + 1):
        try:
            response = http_get(
                current,
                stream=True,
                timeout=DOWNLOAD_TIMEOUT,
                allow_redirects=False,
                headers={"User-Agent": USER_AGENT, "Accept": "image/*"},
            )
        except requests.RequestException as exc:
            raise ProviderError("The download failed.") from exc
        try:
            if response.status_code in _REDIRECT_CODES:
                location = response.headers.get("Location")
                if not location:
                    raise ProviderError("The provider redirected without a target.")
                current = _redirect_target(current, location, hosts)
                continue
            if response.status_code != 200:
                raise ProviderError(f"The image host answered {response.status_code}.")
            declared = response.headers.get("Content-Length", "")
            if declared.isdigit() and int(declared) > max_bytes:
                raise PhotoTooLarge("The photo is too large.")
            buffer = bytearray()
            try:
                for chunk in _stream(response, deadline):
                    buffer.extend(chunk)
                    if len(buffer) > max_bytes:
                        raise PhotoTooLarge("The photo is too large.")
            except requests.RequestException as exc:
                raise ProviderError("The download was interrupted.") from exc
            return bytes(buffer)
        finally:
            response.close()
    raise ProviderError("Too many redirects.")
