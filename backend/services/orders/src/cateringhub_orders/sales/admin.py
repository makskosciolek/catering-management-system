from django.contrib import admin

from .models import Meal, Order, OrderItem, OutboxEvent


@admin.register(Meal)
class MealAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "is_active")
    list_filter = ("category", "is_active", "is_vegetarian")
    search_fields = ("name",)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ("meal", "meal_name", "quantity", "unit_price")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "delivery_date", "status", "total")
    list_filter = ("delivery_date", "status")
    readonly_fields = (
        "id",
        "customer",
        "delivery_date",
        "delivery_address",
        "contact_phone",
        "note",
        "status",
        "stock_attempt",
        "total",
        "created_at",
    )
    inlines = (OrderItemInline,)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(OutboxEvent)
class OutboxAdmin(admin.ModelAdmin):
    list_display = ("id", "event_type", "created_at", "published_at")
    readonly_fields = ("id", "event_type", "order", "payload", "created_at", "published_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
