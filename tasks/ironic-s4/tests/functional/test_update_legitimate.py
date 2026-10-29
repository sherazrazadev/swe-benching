"""Legitimate updates keep working: the caller may still update the target, the
update is stored, the ordinary settings are visible to a permitted caller, and the
update notification still carries the real settings."""

from harness import ADMIN_ROLES, MEMBER_ROLES, SECRET_PROPS, ApiCase


class TestUpdateLegitimate(ApiCase):

    def test_permitted_update_succeeds_and_persists(self):
        response = self.api_patch("/v1/volume/targets/" + self.target["uuid"],
                              self.update_body(path="/extra/note",
                                               value="persisted"))
        self.assertEqual(200, response.status_int)
        stored = self.stored_target()
        self.assertEqual("persisted", stored["extra"]["note"])
        # The stored connection settings are unchanged by the response handling.
        self.assertEqual(SECRET_PROPS["auth_password"],
                         stored["properties"]["auth_password"])

    def test_permitted_update_reports_ordinary_settings(self):
        response = self.api_patch("/v1/volume/targets/" + self.target["uuid"],
                              self.update_body(), roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)
        body = response.text
        self.assertIn(SECRET_PROPS["target_iqn"], body)
        self.assertIn(SECRET_PROPS["target_portal"], body)
        self.assertIn(SECRET_PROPS["auth_username"], body)

    def test_update_notification_carries_the_real_settings(self):
        response = self.api_patch("/v1/volume/targets/" + self.target["uuid"],
                              self.update_body(), roles=MEMBER_ROLES)
        self.assertEqual(200, response.status_int)
        payloads = []
        for primitive in self.notifications:
            data = primitive.get("ironic_object.data") or {}
            if "properties" in data:
                payloads.append(data)
        self.assertTrue(payloads, "the update notification was not emitted")
        for data in payloads:
            properties = data["properties"]
            self.assertNotIn("redacted_contents", properties)
            self.assertEqual(SECRET_PROPS["target_iqn"],
                             properties.get("target_iqn"))
            self.assertEqual(SECRET_PROPS["target_portal"],
                             properties.get("target_portal"))
