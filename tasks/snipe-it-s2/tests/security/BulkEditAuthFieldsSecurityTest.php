<?php

namespace Tests\Feature\Hidden\Security;

use App\Models\User;
use Tests\TestCase;

class BulkEditAuthFieldsSecurityTest extends TestCase
{
    public function test_non_admin_cannot_disable_admin_via_bulk_edit()
    {
        $actor = User::factory()->editUsers()->create();
        $admin = User::factory()->admin()->create(['activated' => 1, 'ldap_import' => 1]);

        $response = $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$admin->id],
            'activated' => '0',
            'ldap_import' => '0',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertTrue((bool) $admin->fresh()->activated);
        $this->assertSame(1, (int) $admin->fresh()->ldap_import);
    }

    public function test_non_admin_cannot_set_directory_password_flag_on_admin()
    {
        $actor = User::factory()->editUsers()->create();
        $admin = User::factory()->admin()->create(['activated' => 1, 'ldap_import' => 0]);

        $response = $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$admin->id],
            'ldap_import' => '1',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertSame(0, (int) $admin->fresh()->ldap_import);
        $this->assertTrue((bool) $admin->fresh()->activated);
    }

    public function test_mixed_selection_applies_auth_fields_only_to_editable_targets()
    {
        $actor = User::factory()->editUsers()->create();
        $admin = User::factory()->admin()->create(['activated' => 1, 'ldap_import' => 1]);
        $ordinary = User::factory()->create(['activated' => 1, 'ldap_import' => 1]);

        $response = $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$admin->id, $ordinary->id],
            'activated' => '0',
            'ldap_import' => '0',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertTrue((bool) $admin->fresh()->activated);
        $this->assertSame(1, (int) $admin->fresh()->ldap_import);
        $this->assertFalse((bool) $ordinary->fresh()->activated);
        $this->assertSame(0, (int) $ordinary->fresh()->ldap_import);
    }

    public function test_admin_cannot_disable_superuser_via_bulk_edit()
    {
        $actor = User::factory()->admin()->create();
        $superuser = User::factory()->superuser()->create(['activated' => 1, 'ldap_import' => 1]);

        $response = $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$superuser->id],
            'activated' => '0',
            'ldap_import' => '0',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertTrue((bool) $superuser->fresh()->activated);
        $this->assertSame(1, (int) $superuser->fresh()->ldap_import);
    }
}
