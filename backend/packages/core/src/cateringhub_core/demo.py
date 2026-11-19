from uuid import NAMESPACE_URL, uuid5


def demo_id(name):
    return uuid5(NAMESPACE_URL, f"cateringhub/demo/{name}")
