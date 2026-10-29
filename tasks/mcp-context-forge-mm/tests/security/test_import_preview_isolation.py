"""Template text in an import file must not be evaluated while the import is previewed."""

import uuid

from conftest import assert_refused, import_preview


def test_import_preview_does_not_evaluate_template(client):
    name = f"import-prompt-{uuid.uuid4().hex[:10]}"
    response = import_preview(
        client,
        [{"name": name, "template": "{{ ''.__class__.__mro__[1].__subclasses__ }}", "description": "preview"}],
    )
    assert_refused(response)
