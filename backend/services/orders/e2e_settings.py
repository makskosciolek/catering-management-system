"""Settings for browser tests that sign in from one loopback address."""

from cateringhub_orders.settings import *  # noqa: F403
from cateringhub_orders.settings import REST_FRAMEWORK as BASE_REST_FRAMEWORK

REST_FRAMEWORK = {
    **BASE_REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {**BASE_REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], "login": "60/min"},
}
