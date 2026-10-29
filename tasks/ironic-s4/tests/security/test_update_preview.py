"""An update preview: the settings saved earlier must not be returned to a caller
who may update the target but not view its connection configuration."""

from harness import MEMBER_ROLES, ApiCase


class TestUpdatePreview(ApiCase):

    def test_preview_withholds_settings_from_unprivileged_caller(self):
        response = self.api_patch(
            "/v1/volume/targets/%s?dry_run=true" % self.target["uuid"],
            self.update_body(path="/extra/preview", value="yes"),
            roles=MEMBER_ROLES)
        self.assertLess(response.status_int, 500)
        self.assert_no_settings(response)
