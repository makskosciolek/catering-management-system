from django.contrib import admin
from django.urls import path

urlpatterns = [path("api/orders/admin/", admin.site.urls)]
