from uuid import UUID

from django.db.models import F
from django.db.models.functions import Lower
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assets.ordering import order_queryset
from apps.assets.uploads import reject_oversize_request

from . import services
from .exceptions import RevisionConflict
from .models import Design, DesignVersion
from .parsers import DesignJSONParser
from .serializers import (
    DEFAULT_VERSION_LABEL,
    BulkSerializer,
    DesignCreateSerializer,
    DesignQuerySerializer,
    DesignSerializer,
    DesignSummarySerializer,
    DesignUpdateSerializer,
    VersionCreateSerializer,
    VersionDetailSerializer,
    VersionSummarySerializer,
)
from .services import THUMBNAIL_MAX_BYTES

UUID_REGEX = "[0-9a-fA-F-]{36}"
FULL_DOCUMENT_ACTIONS = {"retrieve", "restore", "duplicate"}
ORDERING = {
    "updated_at": F("updated_at"),
    "created_at": F("created_at"),
    "title": Lower("title"),
}


def conflict_response(conflict: RevisionConflict) -> Response:
    return Response(
        {
            "error": {
                "code": "revision_conflict",
                "message": "This design was changed elsewhere. Reload it or save your work as a copy.",
            },
            "current": {"revision": conflict.revision, "updated_at": conflict.updated_at},
        },
        status=status.HTTP_409_CONFLICT,
    )


@extend_schema(tags=["designs"])
class DesignViewSet(viewsets.GenericViewSet):
    parser_classes = [DesignJSONParser, MultiPartParser]
    filter_backends: list = []
    lookup_value_regex = UUID_REGEX
    serializer_class = DesignSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Design.objects.none()
        queryset = Design.objects.filter(owner=self.request.user)
        return queryset if self.action in FULL_DOCUMENT_ACTIONS else queryset.defer("document")

    @extend_schema(
        parameters=[
            OpenApiParameter("q", str, description="Title search (case-insensitive)."),
            OpenApiParameter("folder", str, description="A folder id, or `root` for the top level."),
            OpenApiParameter("starred", bool),
            OpenApiParameter("trashed", bool, description="List the trash instead of live designs."),
            OpenApiParameter(
                "ordering", str, description="updated_at, created_at or title; prefix - to reverse."
            ),
        ],
        responses=DesignSummarySerializer(many=True),
    )
    def list(self, request):
        query = DesignQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data
        queryset = self.get_queryset().filter(trashed_at__isnull=not params.get("trashed", False))
        if params.get("q", "").strip():
            queryset = queryset.filter(title__icontains=params["q"].strip())
        if params.get("starred") is not None:
            queryset = queryset.filter(starred=params["starred"])
        if params.get("folder") == "root":
            queryset = queryset.filter(folder__isnull=True)
        elif "folder" in params:
            queryset = queryset.filter(folder_id=UUID(params["folder"]))
        queryset = order_queryset(queryset, params.get("ordering"), ORDERING, "-updated_at")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(DesignSummarySerializer(page, many=True).data)

    @extend_schema(request=DesignCreateSerializer, responses={201: DesignSerializer})
    def create(self, request):
        body = DesignCreateSerializer(data=request.data, context=self.get_serializer_context())
        body.is_valid(raise_exception=True)
        data = body.validated_data
        folder = data.get("folder")
        if "template" in data:
            design = services.create_from_template(
                request.user, data["template"], title=data.get("title"), folder=folder
            )
        else:
            preset = data.get("preset", "")
            document = data.get("document") or services.blank_document(data["width"], data["height"], preset)
            design = services.create_design(
                request.user,
                title=data.get("title", services.DEFAULT_TITLE),
                document=document,
                folder=folder,
            )
        return Response(DesignSerializer(design).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        return Response(DesignSerializer(self.get_object()).data)

    @extend_schema(
        request=DesignUpdateSerializer,
        responses={200: DesignSerializer, 409: None},
        description="Saving `document` needs `base_revision`; a stale value answers 409 `revision_conflict`.",
    )
    def partial_update(self, request, *args, **kwargs):
        design = self.get_object()
        body = DesignUpdateSerializer(data=request.data, partial=True, context=self.get_serializer_context())
        body.is_valid(raise_exception=True)
        try:
            design = services.update_design(design.pk, request.user, body.validated_data)
        except RevisionConflict as conflict:
            return conflict_response(conflict)
        return Response(DesignSerializer(design).data)

    @extend_schema(
        parameters=[OpenApiParameter("permanent", bool, description="Hard-delete (only from the trash).")],
        responses={204: None},
    )
    def destroy(self, request, *args, **kwargs):
        design = self.get_object()
        if request.query_params.get("permanent", "").lower() in {"1", "true", "yes"}:
            services.delete_permanently(design)
        else:
            services.trash_design(design.pk, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses=DesignSerializer)
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        return Response(DesignSerializer(services.restore_trashed(self.get_object())).data)

    @extend_schema(request=None, responses={201: DesignSerializer})
    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        copy = services.duplicate_design(self.get_object(), request.user)
        return Response(DesignSerializer(copy).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        request={
            "multipart/form-data": inline_serializer("ThumbnailUpload", {"image": serializers.ImageField()})
        },
        responses=inline_serializer("ThumbnailUrl", {"thumbnail_url": serializers.CharField()}),
    )
    @action(detail=True, methods=["put"], parser_classes=[MultiPartParser])
    def thumbnail(self, request, pk=None):
        design = self.get_object()
        reject_oversize_request(request, THUMBNAIL_MAX_BYTES)
        image = request.data.get("image")
        if image is None or not hasattr(image, "read"):
            raise serializers.ValidationError({"image": ["Upload the thumbnail as the `image` file field."]})
        design = services.set_thumbnail(design, image)
        return Response({"thumbnail_url": design.thumbnail.url})

    @extend_schema(
        request=BulkSerializer,
        responses=inline_serializer("BulkResult", {"affected": serializers.IntegerField()}),
    )
    @action(detail=False, methods=["post"])
    def bulk(self, request):
        body = BulkSerializer(data=request.data, context=self.get_serializer_context())
        body.is_valid(raise_exception=True)
        data = body.validated_data
        affected = services.bulk_apply(request.user, data["ids"], data["action"], data.get("folder"))
        return Response({"affected": affected})

    @extend_schema(request=None, responses={204: None})
    @action(detail=False, methods=["delete"])
    def trash(self, request):
        services.empty_trash(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _own_design(request, design_pk) -> Design:
    return get_object_or_404(Design.objects.filter(owner=request.user).defer("document"), pk=design_pk)


@extend_schema(tags=["designs"])
class DesignVersionListView(generics.GenericAPIView):
    parser_classes = [DesignJSONParser]
    filter_backends: list = []
    serializer_class = VersionSummarySerializer

    @extend_schema(responses=VersionSummarySerializer(many=True))
    def get(self, request, design_pk):
        design = _own_design(request, design_pk)
        versions = (
            DesignVersion.objects.filter(design=design).defer("document").order_by("-created_at", "-pk")
        )
        page = self.paginate_queryset(versions)
        return self.get_paginated_response(VersionSummarySerializer(page, many=True).data)

    @extend_schema(request=VersionCreateSerializer, responses={201: VersionSummarySerializer})
    def post(self, request, design_pk):
        design = _own_design(request, design_pk)
        body = VersionCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        label = body.validated_data.get("label") or DEFAULT_VERSION_LABEL
        version = services.create_manual_version(design.pk, request.user, label)
        return Response(VersionSummarySerializer(version).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["designs"], responses=VersionDetailSerializer)
class DesignVersionDetailView(APIView):
    def get(self, request, design_pk, version_pk):
        design = _own_design(request, design_pk)
        version = get_object_or_404(DesignVersion, pk=version_pk, design=design)
        return Response(VersionDetailSerializer(version).data)


@extend_schema(tags=["designs"], request=None, responses=DesignSerializer)
class DesignVersionRestoreView(APIView):
    def post(self, request, design_pk, version_pk):
        design = _own_design(request, design_pk)
        restored = services.restore_version(design.pk, version_pk, request.user)
        return Response(DesignSerializer(restored).data)
