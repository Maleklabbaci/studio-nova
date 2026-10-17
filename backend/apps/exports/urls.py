from django.urls import path

from .views import PdfExportView

urlpatterns = [
    path("exports/pdf/", PdfExportView.as_view(), name="export-pdf"),
]
