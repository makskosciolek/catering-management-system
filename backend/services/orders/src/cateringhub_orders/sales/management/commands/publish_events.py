import logging
import time

import pika
from django.core.management.base import BaseCommand, CommandError
from django.db import OperationalError, close_old_connections

from ...publisher import connect, publish_one, setup_channel

logger = logging.getLogger("cateringhub.orders")


class Command(BaseCommand):
    help = "Publikuje zapisane zdarzenia zamówień do RabbitMQ."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Opróżnia bieżący outbox i kończy.")

    def handle(self, *args, **options):
        while True:
            try:
                with connect() as connection:
                    channel = setup_channel(connection)
                    while True:
                        close_old_connections()
                        if not publish_one(channel):
                            if options["once"]:
                                return
                            connection.sleep(1)
            except (pika.exceptions.AMQPError, OperationalError) as exc:
                if options["once"]:
                    raise CommandError(
                        f"Publikacja nie powiodła się: {type(exc).__name__}"
                    ) from exc
                logger.warning("publisher retry reason=%s", type(exc).__name__)
                time.sleep(2)
