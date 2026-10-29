"""Legitimate use of the two auxiliary views: a preview changes nothing, and the
filtered listing returns the matching target."""

from harness import ADMIN_ROLES, MEMBER_ROLES, SECRET_PROPS, ApiCase


class TestPreviewAndFilter(ApiCase):

    def test_preview_does_not_persist_the_change(self):
        response = self.api_patch(
            "/v1/volume/targets/%s?dry_run=true" % self.target["uuid"],
            self.update_body(path="/extra/preview", value="dry"),
            roles=MEMBER_ROLES)
        self.assertEqual(200, response.status_int)
        self.assertNotIn("preview", self.stored_target()["extra"])
        # A real update still persists.
        response = self.api_patch("/v1/volume/targets/" + self.target["uuid"],
                              self.update_body(path="/extra/preview",
                                               value="real"))
        self.assertEqual(200, response.status_int)
        self.assertEqual("real", self.stored_target()["extra"]["preview"])

    def test_filter_returns_only_matching_target(self):
        other = {
            "node_uuid": self.node["uuid"],
            "volume_type": "iscsi",
            "boot_index": 13,
            "volume_id": "volume-other",
            "properties": {"target_iqn": "iqn.other:storage"},
        }
        created = self.api_post("/v1/volume/targets", other, roles=ADMIN_ROLES)
        self.assertEqual(201, created.status_int)
        response = self.api_get(
            "/v1/volume/targets?volume_id=%s&detail=True" % self.target[
                "volume_id"], roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)
        targets = response.json["targets"]
        self.assertEqual(1, len(targets))
        self.assertEqual(self.target["uuid"], targets[0]["uuid"])
        self.assertEqual(SECRET_PROPS["target_iqn"],
                         targets[0]["properties"]["target_iqn"])
