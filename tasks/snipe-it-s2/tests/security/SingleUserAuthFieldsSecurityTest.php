<?php

namespace Tests\Feature\Hidden\Security;

use App\Models\User;
use Tests\TestCase;

class SingleUserAuthFieldsSecurityTest extends TestCase
{
    public function test_non_admin_cannot_disable_admin_via_single_update()
    {
        $actor = User::factory()->editUsers()->create();
        $admin = User::factory()->admin()->create(['activated' => 1]);

        $response = $this->actingAs($actor)->put(route('users.update', $admin), [
            'first_name' => $admin->first_name,
            'username' => $admin->username,
            'activated' => '0',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertTrue((bool) $admin->fresh()->activated);
    }

    public function test_admin_cannot_disable_superuser_via_single_update()
    {
        $actor = User::factory()->admin()->create();
        $superuser = User::factory()->superuser()->create(['activated' => 1]);

        $response = $this->actingAs($actor)->put(route('users.update', $superuser), [
            'first_name' => $superuser->first_name,
            'username' => $superuser->username,
            'activated' => '0',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertTrue((bool) $superuser->fresh()->activated);
    }
}
