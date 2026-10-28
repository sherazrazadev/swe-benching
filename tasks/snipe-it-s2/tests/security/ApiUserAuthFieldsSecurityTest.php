<?php

namespace Tests\Feature\Hidden\Security;

use App\Models\User;
use Tests\TestCase;

class ApiUserAuthFieldsSecurityTest extends TestCase
{
    public function test_non_admin_cannot_set_directory_password_flag_on_admin_via_api()
    {
        $actor = User::factory()->editUsers()->create();
        $admin = User::factory()->admin()->create(['ldap_import' => 0, 'activated' => 1]);

        $response = $this->actingAsForApi($actor)->patchJson(route('api.users.update', $admin), [
            'ldap_import' => 1,
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertSame(0, (int) $admin->fresh()->ldap_import);
        $this->assertTrue((bool) $admin->fresh()->activated);
    }

    public function test_admin_cannot_set_directory_password_flag_on_superuser_via_api()
    {
        $actor = User::factory()->admin()->create();
        $superuser = User::factory()->superuser()->create(['ldap_import' => 0, 'activated' => 1]);

        $response = $this->actingAsForApi($actor)->patchJson(route('api.users.update', $superuser), [
            'ldap_import' => 1,
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertSame(0, (int) $superuser->fresh()->ldap_import);
    }
}
