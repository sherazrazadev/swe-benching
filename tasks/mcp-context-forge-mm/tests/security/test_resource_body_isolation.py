"""A stored text resource must not be rendered as code when it is read."""

from conftest import assert_refused, create_text_resource, read_resource


def test_resource_body_is_not_evaluated(client):
    created = create_text_resource(client, "{{ ''.__class__.__mro__[1].__subclasses__ }}")
    assert created.status_code == 200, created.text
    response = read_resource(client, created.json()["id"])
    assert_refused(response)
