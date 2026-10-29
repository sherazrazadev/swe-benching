"""A filtered listing of the same resource: the connection settings must not reach
a caller who may read the resource but not view its connection configuration."""

from harness import READER_ROLES, ApiCase


class TestFilteredListing(ApiCase):

    def test_filtered_listing_withholds_settings_from_unprivileged_caller(self):
        response = self.api_get(
            "/v1/volume/targets?volume_id=%s&detail=True" % self.target[
                "volume_id"], roles=READER_ROLES)
        self.assertLess(response.status_int, 500)
        self.assert_no_settings(response)
