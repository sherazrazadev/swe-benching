"""Read responses: the connection settings must not appear in clear text for a
caller who is allowed to view them, and the listing path must behave the same as
the single-object path."""

from harness import ADMIN_ROLES, ApiCase


class TestReadPaths(ApiCase):

    def test_single_read_masks_secret_for_permitted_caller(self):
        response = self.api_get("/v1/volume/targets/" + self.target["uuid"],
                            roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)
        self.assert_secret_withheld(response)
        self.assertIn(self.target["properties"]["target_iqn"], response.text)

    def test_detail_listing_masks_secret_for_permitted_caller(self):
        response = self.api_get("/v1/volume/targets?detail=True",
                            roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)
        self.assert_secret_withheld(response)
        self.assertIn(self.target["properties"]["target_iqn"], response.text)

    def test_field_subset_listing_masks_secret_for_permitted_caller(self):
        response = self.api_get("/v1/volume/targets?fields=properties",
                            roles=ADMIN_ROLES)
        self.assertEqual(200, response.status_int)
        self.assert_secret_withheld(response)
        self.assertIn(self.target["properties"]["target_iqn"], response.text)
