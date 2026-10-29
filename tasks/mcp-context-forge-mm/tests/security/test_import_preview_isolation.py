"""Template text in an import file must not be evaluated while the import is previewed."""

import uuid

from conftest import OBFUSCATED_GADGET, assert_refused, import_preview, listed_prompt_identifiers


def _assert_preview_refused(client, template):
    name = f"import-prompt-{uuid.uuid4().hex[:10]}"
    response = import_preview(client, [{"name": name, "template": template, "description": "preview"}])
    assert_refused(response)
    # Previewing must not have stored the unsafe template.
    assert name not in listed_prompt_identifiers(client)


def test_import_preview_does_not_evaluate_template(client):
    _assert_preview_refused(client, "{{ ''.__class__.__mro__[1].__subclasses__ }}")


def test_import_preview_does_not_evaluate_obfuscated_template(client):
    _assert_preview_refused(client, OBFUSCATED_GADGET)
