from django.conf import settings
from django.db import connection
from django.http import HttpRequest, JsonResponse
from django.views.decorators.cache import cache_control
from django.views.defaults import page_not_found, server_error
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.collab.availability import max_participants, realtime_enabled

from .mlmodels.availability import background_removal_model

_NON_DELIVERING_EMAIL_BACKENDS = {
    "django.core.mail.backends.console.EmailBackend",
    "django.core.mail.backends.dummy.EmailBackend",
    "django.core.mail.backends.filebased.EmailBackend",
    "django.core.mail.backends.locmem.EmailBackend",
}

_CONFIG_SCHEMA = inline_serializer(
    "AppConfig",
    {
        "google_client_id": serializers.CharField(),
        "features": inline_serializer(
            "AppConfigFeatures",
            {
                "stock_photos": serializers.BooleanField(),
                "server_pdf": serializers.BooleanField(),
                "google_login": serializers.BooleanField(),
                "email_verification": serializers.BooleanField(),
                "background_removal": serializers.BooleanField(),
                "realtime": serializers.BooleanField(),
            },
        ),
        "limits": inline_serializer(
            "AppConfigLimits",
            {
                "max_upload_bytes": serializers.IntegerField(),
                "max_pages": serializers.IntegerField(),
                "max_document_bytes": serializers.IntegerField(),
                "realtime_max_participants": serializers.IntegerField(),
            },
        ),
        "assets": inline_serializer(
            "AppConfigAssets",
            {
                "background_removal_model": inline_serializer(
                    "BackgroundRemovalModel",
                    {
                        "id": serializers.CharField(),
                        "name": serializers.CharField(),
                        "url": serializers.CharField(),
                        "bytes": serializers.IntegerField(),
                        "sha256": serializers.CharField(),
                        "input": inline_serializer(
                            "BackgroundRemovalModelInput",
                            {
                                "name": serializers.CharField(),
                                "size": serializers.IntegerField(),
                                "mean": serializers.ListField(child=serializers.FloatField()),
                                "std": serializers.ListField(child=serializers.FloatField()),
                                "rescale": serializers.ChoiceField(choices=["max", "255"]),
                            },
                        ),
                        "output": serializers.CharField(),
                    },
                    allow_null=True,
                ),
            },
        ),
    },
)


@extend_schema(responses={200: OpenApiResponse(description="Liveness and database check.")}, tags=["system"])
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([])
def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return Response({"status": "ok"})


@extend_schema(responses={200: _CONFIG_SCHEMA}, tags=["system"])
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
@cache_control(public=True, max_age=60)
def config(request):
    """Public runtime configuration: optional integrations, size limits and the models to download."""
    email_delivers = settings.EMAIL_BACKEND not in _NON_DELIVERING_EMAIL_BACKENDS
    background_removal = background_removal_model()
    return Response(
        {
            "google_client_id": settings.GOOGLE_CLIENT_ID,
            "features": {
                "stock_photos": bool(settings.UNSPLASH_ACCESS_KEY or settings.PEXELS_API_KEY),
                "server_pdf": settings.SERVER_PDF_ENABLED,
                "google_login": bool(settings.GOOGLE_CLIENT_ID),
                "email_verification": email_delivers,
                "background_removal": background_removal is not None,
                "realtime": realtime_enabled(),
            },
            "limits": {
                "max_upload_bytes": settings.MAX_UPLOAD_BYTES,
                "max_pages": settings.MAX_DESIGN_PAGES,
                "max_document_bytes": settings.MAX_DESIGN_DOCUMENT_BYTES,
                "realtime_max_participants": max_participants(),
            },
            "assets": {"background_removal_model": background_removal},
        }
    )


def _wants_json(request: HttpRequest) -> bool:
    return request.path.startswith("/api/")


def not_found(request: HttpRequest, exception: Exception) -> JsonResponse:
    """`handler404`: unknown URLs under /api/ answer with the uniform error envelope."""
    if _wants_json(request):
        body = {"error": {"code": "not_found", "message": "Not found."}}
        return JsonResponse(body, status=404)
    return page_not_found(request, exception)


def server_failure(request: HttpRequest) -> JsonResponse:
    """`handler500`: unhandled errors under /api/ answer with the uniform error envelope."""
    if _wants_json(request):
        body = {"error": {"code": "server_error", "message": "Something went wrong on our side."}}
        return JsonResponse(body, status=500)
    return server_error(request)
