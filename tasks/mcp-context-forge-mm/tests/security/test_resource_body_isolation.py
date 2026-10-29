"""A stored text resource must not be rendered as code when it is read.

Unsafe text may be refused when it is authored or when it is read; either way the
caller gets no runtime value, and a refused creation leaves no resource behind.
"""

import uuid

from conftest import (
    OBFUSCATED_GADGET,
    assert_refused,
    create_text_resource,
    listed_resource_uris,
    overwrite_resource_text,
    read_resource,
)

UNSAFE_BODY = "{{ ''.__class__.__mro__[1].__subclasses__ }}"


def _create_or_refuse(client, body):
    """Create a resource, tolerating a refusal at creation as the instruction allows."""
    uri = f"res://hidden/unsafe-{uuid.uuid4().hex[:12]}"
    created = create_text_resource(client, body, uri=uri)
    if created.status_code != 200:
        assert_refused(created)
        # A refusal must leave no resource created.
        assert uri not in listed_resource_uris(client)
        return None
    return created


def test_resource_body_is_not_evaluated(client):
    created = _create_or_refuse(client, UNSAFE_BODY)
    if created is None:
        return
    assert_refused(read_resource(client, created.json()["id"]))


def test_obfuscated_resource_body_is_not_evaluated(client):
    created = _create_or_refuse(client, OBFUSCATED_GADGET)
    if created is None:
        return
    assert_refused(read_resource(client, created.json()["id"]))


def test_stored_resource_body_is_not_evaluated_on_read(client):
    """Text that reached storage another way must still be refused when it is read."""
    created = create_text_resource(client, "benign stored body")
    assert created.status_code == 200, created.text
    resource_id = created.json()["id"]
    overwrite_resource_text(resource_id, UNSAFE_BODY)
    assert_refused(read_resource(client, resource_id))
