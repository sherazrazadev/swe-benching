"""A stored prompt must not make Python's format machinery walk into objects.

The template parses as Jinja but fails while rendering; the stored text also carries a
single-brace field. Whatever the gateway does about the failed render, it must not hand
the text to Python's format language, whose attribute and index syntax reaches objects.
"""

from conftest import assert_refused, assert_rpc_refused, create_prompt, render_prompt, render_prompt_rpc


def _payload():
    return {
        "template": "{{ range() }}{x.__class__.__mro__[1].__subclasses__}",
        # The dotted key satisfies the argument schema the gateway derives from the
        # single-brace field; x is the value the field traverses.
        "arguments": {"x": "hello", "x.__class__.__mro__[1].__subclasses__": "placeholder"},
    }


def test_render_does_not_expose_runtime_objects(client):
    payload = _payload()
    created = create_prompt(client, payload["template"])
    name = created.json().get("name") if created.status_code == 200 else "missing-prompt"
    response = render_prompt(client, name, payload["arguments"])
    assert_refused(response)


def test_json_rpc_render_does_not_expose_runtime_objects(client):
    payload = _payload()
    created = create_prompt(client, payload["template"])
    name = created.json().get("name") if created.status_code == 200 else "missing-prompt"
    response = render_prompt_rpc(client, name, payload["arguments"])
    assert_rpc_refused(response)


def test_render_from_declared_argument_does_not_expose_runtime_objects(client):
    """The traversal starts from a legitimate, declared string argument."""
    template = "{{ range() }}{name.__class__.__mro__[1].__subclasses__}"
    created = create_prompt(client, template, arguments=[{"name": "name", "description": "who", "required": True}])
    stored_name = created.json().get("name") if created.status_code == 200 else "missing-prompt"
    arguments = {
        "name": "hello",
        "name.__class__.__mro__[1].__subclasses__": "placeholder",
    }
    assert_refused(render_prompt(client, stored_name, arguments))
