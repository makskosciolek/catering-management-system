import json
import logging
import os

import pika
from django.db import transaction
from django.utils import timezone

from .models import OutboxEvent

logger = logging.getLogger("cateringhub.orders")
EXCHANGE = "cateringhub.events"
DEAD_LETTER_EXCHANGE = "cateringhub.deadletter"
INVENTORY_QUEUE = "cateringhub.inventory.events"


def connect():
    return pika.BlockingConnection(
        pika.ConnectionParameters(
            host=os.environ.get("RABBITMQ_HOST", "127.0.0.1"),
            port=int(os.environ.get("RABBITMQ_PORT", "5672")),
            virtual_host=os.environ.get("RABBITMQ_VHOST", "cateringhub"),
            credentials=pika.PlainCredentials(
                os.environ["RABBITMQ_USER"],
                os.environ["RABBITMQ_PASSWORD"],
            ),
            socket_timeout=5,
            blocked_connection_timeout=5,
        )
    )


def setup_channel(connection):
    channel = connection.channel()
    channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
    channel.exchange_declare(exchange=DEAD_LETTER_EXCHANGE, exchange_type="direct", durable=True)
    channel.queue_declare(queue=INVENTORY_QUEUE + ".dead", durable=True)
    channel.queue_bind(
        queue=INVENTORY_QUEUE + ".dead",
        exchange=DEAD_LETTER_EXCHANGE,
        routing_key=INVENTORY_QUEUE,
    )
    channel.queue_declare(
        queue=INVENTORY_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
            "x-dead-letter-routing-key": INVENTORY_QUEUE,
        },
    )
    channel.queue_bind(queue=INVENTORY_QUEUE, exchange=EXCHANGE, routing_key="order.submitted")
    channel.confirm_delivery()
    return channel


@transaction.atomic
def publish_one(channel):
    event = (
        OutboxEvent.objects.select_for_update(skip_locked=True)
        .filter(
            published_at__isnull=True,
        )
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
            delivery_mode=2,
            content_type="application/json",
            message_id=str(event.id),
        ),
        mandatory=True,
    )
    event.published_at = timezone.now()
    event.save(update_fields=("published_at",))
    logger.info("published event=%s order=%s", event.id, event.order_id)
    return True
