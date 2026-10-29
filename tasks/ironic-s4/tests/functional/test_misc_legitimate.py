"""Boundary cases and unrelated fields.

Empty connection settings must not break a response, and a field that is not
connection configuration must keep the value it was given.
"""

from harness import (ADMIN_ROLES, EXTRA_MARKER, SECRET_PROPS, ApiCase)


class TestMiscLegitimate(ApiCase):

    def test_empty_connection_settings_do_not_error(self):
        self.dbapi.update_volume_target(self.target["uuid"],
                                        {"properties": {}})
        response = self.api_get("/v1/volume/targets/" + self.target["uuid"],
                            roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)
        response = self.api_patch("/v1/volume/targets/" + self.target["uuid"],
                              self.update_body(), roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)

    def test_missing_connection_settings_do_not_error(self):
        self.dbapi.update_volume_target(self.target["uuid"],
                                        {"properties": None})
        response = self.api_get("/v1/volume/targets?detail=True",
                            roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)

    def test_unrelated_field_keeps_its_value(self):
        before = self.api_get("/v1/volume/targets/" + self.target["uuid"],
                          roles=ADMIN_ROLES)
        self.assertEqual(EXTRA_MARKER,
                         before.json["extra"]["auth_password"])
        updated = self.api_patch("/v1/volume/targets/" + self.target["uuid"],
                             self.update_body(path="/extra/note",
                                              value="kept"),
                             roles=ADMIN_ROLES)
        self.assertEqual(200, updated.status_int)
        after = self.api_get("/v1/volume/targets/" + self.target["uuid"],
                         roles=ADMIN_ROLES)
        self.assertEqual(EXTRA_MARKER, after.json["extra"]["auth_password"])
        self.assertIn(SECRET_PROPS["target_iqn"], after.text)
