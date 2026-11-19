import logging
import time

import pika
from django.core.management.base import BaseCommand, CommandError
from django.db import OperationalError, close_old_connections

from .messaging import InvalidEvent, connect, decode_event, publish_one, setup_channel

logger = logging.getLogger("cateringhub.events")


class EventWorkerCommand(BaseCommand):
    outbox_model = None
    queue = None

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--once", action="store_true", help="Wysyła zaległe zdarzenia i kończy.")
        mode.add_argument("--consume", action="store_true", help="Publikuje i odbiera zdarzenia.")

    def handle(self, *args, **options):
        while True:
            try:
                with connect() as connection:
                    channel = setup_channel(connection)
                    if options["consume"]:
                        channel.basic_qos(prefetch_count=1)
                        channel.basic_consume(self.queue, self.receive)
                    while True:
                        close_old_connections()
                        sent = publish_one(channel, self.outbox_model)
                        if options["once"] and not sent:
                            return
                        connection.process_data_events(time_limit=0 if sent else 1)
            except (pika.exceptions.AMQPError, OperationalError) as exc:
                if options["once"]:
                    raise CommandError(
                        f"Publikacja nie powiodła się: {type(exc).__name__}"
                    ) from exc
                logger.warning("worker retry queue=%s reason=%s", self.queue, type(exc).__name__)
                time.sleep(2)

    def receive(self, channel, method, properties, body):
        try:
            event = decode_event(method.routing_key, body)
            self.apply_event(event)
        except InvalidEvent as exc:
            logger.warning("rejected route=%s reason=%s", method.routing_key, exc)
            channel.basic_reject(method.delivery_tag, requeue=False)
        else:
            channel.basic_ack(method.delivery_tag)
