"""The reported trigger: the update response hands the connection settings back to a
caller who may update the target but may not view its connection configuration."""

from harness import ADMIN_ROLES, MEMBER_ROLES, ApiCase

NEW_SECRET_PROPS = {
    "target_iqn": "iqn.supplied-by-caller:target",
    "target_portal": "192.0.2.55:3260",
    "auth_username": "supplied-login",
    "auth_password": "Supplied-CHAP-Secret-77c1",
}


class TestUpdateResponse(ApiCase):

    def test_update_withholds_settings_from_caller_without_view_permission(self):
        response = self.api_patch("/v1/volume/targets/" + self.target["uuid"],
                              self.update_body())
        self.assertLess(response.status_int, 500)
        self.assert_no_settings(response)

    def test_update_does_not_echo_settings_supplied_in_the_patch(self):
        body = [{"op": "replace", "path": "/properties",
                 "value": dict(NEW_SECRET_PROPS)}]
        response = self.api_patch("/v1/volume/targets/" + self.target["uuid"],
                              body, roles=MEMBER_ROLES)
        self.assertLess(response.status_int, 500)
        for value in NEW_SECRET_PROPS.values():
            self.assertNotIn(value, response.text)

    def test_update_masks_secret_for_caller_with_view_permission(self):
        response = self.api_patch("/v1/volume/targets/" + self.target["uuid"],
                              self.update_body(), roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)
        self.assert_secret_withheld(response)
        # The ordinary settings stay visible to the permitted caller.
        self.assertIn(self.target["properties"]["target_iqn"], response.text)
