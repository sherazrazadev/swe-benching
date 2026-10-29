"""Legitimate resource bodies and import previews must keep working."""

import uuid

from conftest import create_text_resource, import_preview, read_resource


def test_plain_resource_body_is_returned_unchanged(client):
    body = "plain resource body 123"
    created = create_text_resource(client, body)
    assert created.status_code == 200, created.text
    response = read_resource(client, created.json()["id"])
    assert response.status_code == 200, response.text
    assert response.json()["text"] == body


def test_resource_body_placeholders_expand(client):
    created = create_text_resource(client, "Resource {{ name }} at {{ uri }}", name="live-resource")
    assert created.status_code == 200, created.text
    resource = created.json()
    response = read_resource(client, resource["id"])
    assert response.status_code == 200, response.text
    assert response.json()["text"] == f"Resource live-resource at {resource['uri']}"


def test_import_preview_renders_a_benign_template(client):
    name = f"benign-import-{uuid.uuid4().hex[:10]}"
    response = import_preview(client, [{"name": name, "template": "Hello {{ name }}", "description": "preview"}])
    assert response.status_code == 200, response.text
    preview = response.json()["preview"]
    assert preview["summary"]["total_items"] == 1
    assert "Hello " + name in response.text


def test_import_preview_lists_the_imported_item(client):
    name = f"listed-import-{uuid.uuid4().hex[:10]}"
    response = import_preview(client, [{"name": name, "template": "plain preview", "description": "preview"}])
    assert response.status_code == 200, response.text
    items = response.json()["preview"]["items"]["prompts"]
    assert [item["name"] for item in items] == [name]
