from cateringhub_core.auth import PRODUCTION_WRITE_ROLES
from rest_framework.permissions import SAFE_METHODS, BasePermission

FULFILLMENT_ROLES = {"kitchen", "driver", "manager", "admin"}
PRODUCTION_READ_ROLES = PRODUCTION_WRITE_ROLES | {"warehouse"}


class FulfillmentPermission(BasePermission):
    message = "Ta rola nie ma dostępu do Realizacji."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in FULFILLMENT_ROLES


class ProductionPermission(BasePermission):
    message = "Ta rola nie ma uprawnień do tej operacji w kuchni."

    def has_permission(self, request, view):
        roles = PRODUCTION_READ_ROLES if request.method in SAFE_METHODS else PRODUCTION_WRITE_ROLES
        return request.user.is_authenticated and request.user.role in roles
