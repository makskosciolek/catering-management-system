import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cateringhub_fulfillment.settings")
application = get_wsgi_application()
