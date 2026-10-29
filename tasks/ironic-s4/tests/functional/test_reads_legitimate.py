"""Legitimate reads keep working, including the existing withholding for callers
without the view permission and the default field selection."""

from harness import ADMIN_ROLES, READER_ROLES, SECRET_PROPS, ApiCase


class TestReadsLegitimate(ApiCase):

    def test_reader_can_still_read_with_settings_withheld(self):
        response = self.api_get("/v1/volume/targets/" + self.target["uuid"],
                            roles=READER_ROLES)
        self.assertEqual(200, response.status_int)
        self.assert_no_settings(response)

    def test_reader_can_still_read_the_listing(self):
        response = self.api_get("/v1/volume/targets?detail=True",
                            roles=READER_ROLES)
        self.assertEqual(200, response.status_int)
        self.assert_no_settings(response)

    def test_permitted_caller_sees_ordinary_settings(self):
        single = self.api_get("/v1/volume/targets/" + self.target["uuid"],
                          roles=ADMIN_ROLES)
        self.assertEqual(200, single.status_int)
        self.assertEqual(SECRET_PROPS["target_iqn"],
                         single.json["properties"]["target_iqn"])
        listing = self.api_get("/v1/volume/targets?detail=True", roles=ADMIN_ROLES)
        self.assertEqual(200, listing.status_int)
        self.assertEqual(SECRET_PROPS["target_iqn"],
                         listing.json["targets"][0]["properties"][
                             "target_iqn"])

    def test_default_listing_still_omits_properties(self):
        response = self.api_get("/v1/volume/targets", roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)
        for item in response.json["targets"]:
            self.assertNotIn("properties", item)

    def test_field_subset_still_selects_only_requested_fields(self):
        response = self.api_get("/v1/volume/targets?fields=uuid",
                            roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)
        for item in response.json["targets"]:
            self.assertEqual({"uuid", "links"}, set(item))
