from rest_framework.permissions import BasePermission

FULFILLMENT_ROLES = {"kitchen", "driver", "manager", "admin"}


class FulfillmentPermission(BasePermission):
    message = "Ta rola nie ma dostępu do Realizacji."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in FULFILLMENT_ROLES
