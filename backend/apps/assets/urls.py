from django.urls import path
from rest_framework.routers import SimpleRouter

from .stock import StockImportView, StockSearchView
from .views import AssetViewSet

router = SimpleRouter()
router.register("assets", AssetViewSet, basename="asset")

urlpatterns = [
    *router.urls,
    path("stock/photos/", StockSearchView.as_view(), name="stock-photos"),
    path("stock/photos/import/", StockImportView.as_view(), name="stock-photo-import"),
]
