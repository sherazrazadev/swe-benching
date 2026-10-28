<?php

namespace Tests\Feature\Hidden\Security;

use App\Models\User;
use Tests\TestCase;

class ToggleActivationSecurityTest extends TestCase
{
    public function test_non_admin_cannot_disable_admin_via_toggle()
    {
        $actor = User::factory()->editUsers()->create();
        $admin = User::factory()->admin()->create(['activated' => 1, 'ldap_import' => 0]);

        $response = $this->actingAs($actor)->post(route('users.toggle_active', $admin), [
            'activated' => '0',
            'ldap_import' => '1',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertTrue((bool) $admin->fresh()->activated);
        $this->assertSame(0, (int) $admin->fresh()->ldap_import);
    }

    public function test_admin_cannot_disable_superuser_via_toggle()
    {
        $actor = User::factory()->admin()->create();
        $superuser = User::factory()->superuser()->create(['activated' => 1, 'ldap_import' => 0]);

        $response = $this->actingAs($actor)->post(route('users.toggle_active', $superuser), [
            'activated' => '0',
            'ldap_import' => '1',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertTrue((bool) $superuser->fresh()->activated);
        $this->assertSame(0, (int) $superuser->fresh()->ldap_import);
    }
}
