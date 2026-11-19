import json
import logging
import os
from dataclasses import dataclass
from uuid import UUID

import pika
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("cateringhub.events")
EXCHANGE = "cateringhub.events"
DEAD_LETTER_EXCHANGE = "cateringhub.deadletter"
INVENTORY_QUEUE = "cateringhub.inventory.events"
ORDERS_STOCK_QUEUE = "cateringhub.orders.stock"
ORDER_SUBMITTED = "order.submitted"
STOCK_RESERVED = "stock.reserved"
STOCK_SHORTAGE = "stock.shortage"
QUEUES = {
    INVENTORY_QUEUE: (ORDER_SUBMITTED,),
    ORDERS_STOCK_QUEUE: (STOCK_RESERVED, STOCK_SHORTAGE),
}


class InvalidEvent(ValueError):
    pass


@dataclass(frozen=True)
class Event:
    id: UUID
    type: str
    order_id: UUID
    payload: dict


def decode_event(routing_key, body):
    try:
        data = json.loads(body)
        if (
            type(data["version"]) is not int
            or data["version"] != 1
            or data["event_type"] != routing_key
            or not isinstance(data["payload"], dict)
        ):
            raise InvalidEvent("Niezgodna wersja, typ albo treść zdarzenia.")
        return Event(UUID(data["event_id"]), routing_key, UUID(data["order_id"]), data["payload"])
    except InvalidEvent:
        raise
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        raise InvalidEvent("Nieprawidłowa koperta zdarzenia.") from exc


def connect():
    return pika.BlockingConnection(
        pika.ConnectionParameters(
            host=os.environ.get("RABBITMQ_HOST", "127.0.0.1"),
            port=int(os.environ.get("RABBITMQ_PORT", "5672")),
            virtual_host=os.environ.get("RABBITMQ_VHOST", "cateringhub"),
            credentials=pika.PlainCredentials(
                os.environ["RABBITMQ_USER"], os.environ["RABBITMQ_PASSWORD"]
            ),
            socket_timeout=5,
            blocked_connection_timeout=5,
        )
    )


def setup_channel(connection):
    channel = connection.channel()
    channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
    channel.exchange_declare(exchange=DEAD_LETTER_EXCHANGE, exchange_type="direct", durable=True)
    for queue, routes in QUEUES.items():
        dead_queue = queue + ".dead"
        channel.queue_declare(queue=dead_queue, durable=True)
        channel.queue_bind(queue=dead_queue, exchange=DEAD_LETTER_EXCHANGE, routing_key=queue)
        channel.queue_declare(
            queue=queue,
            durable=True,
            arguments={
                "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
                "x-dead-letter-routing-key": queue,
            },
        )
        for route in routes:
            channel.queue_bind(queue=queue, exchange=EXCHANGE, routing_key=route)
    channel.confirm_delivery()
    return channel


@transaction.atomic
def publish_one(channel, outbox_model):
    event = (
        outbox_model.objects.select_for_update(skip_locked=True)
        .filter(published_at__isnull=True)
        .first()
    )
    if event is None:
        return False
    body = json.dumps(
        {
            "event_id": str(event.id),
            "event_type": event.event_type,
            "version": 1,
            "occurred_at": event.created_at.isoformat(),
            "order_id": str(event.order_id),
            "payload": event.payload,
        }
    )
    channel.basic_publish(
        exchange=EXCHANGE,
        routing_key=event.event_type,
        body=body,
        properties=pika.BasicProperties(
            delivery_mode=2, content_type="application/json", message_id=str(event.id)
        ),
        mandatory=True,
    )
    event.published_at = timezone.now()
    event.save(update_fields=("published_at",))
    logger.info("published type=%s event=%s order=%s", event.event_type, event.id, event.order_id)
    return True
