from rest_framework.permissions import SAFE_METHODS, BasePermission

WAREHOUSE_WRITERS = {"warehouse", "admin"}
WAREHOUSE_READERS = WAREHOUSE_WRITERS | {"manager"}


class WarehousePermission(BasePermission):
    message = "Ta rola nie ma uprawnień do tej operacji w magazynie."

    def has_permission(self, request, view):
        roles = WAREHOUSE_READERS if request.method in SAFE_METHODS else WAREHOUSE_WRITERS
        return request.user.is_authenticated and request.user.role in roles
