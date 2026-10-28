<?php

namespace Tests\Feature\Hidden\Functional;

use App\Models\User;
use Tests\TestCase;

class ApiUserFunctionalTest extends TestCase
{
    public function test_non_admin_can_set_directory_password_flag_on_regular_user_via_api()
    {
        $actor = User::factory()->editUsers()->create();
        $target = User::factory()->create(['ldap_import' => 0]);

        $response = $this->actingAsForApi($actor)->patchJson(route('api.users.update', $target), [
            'ldap_import' => 1,
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertSame(1, (int) $target->fresh()->ldap_import);
    }

    public function test_non_admin_can_clear_directory_password_flag_on_regular_user_via_api()
    {
        $actor = User::factory()->editUsers()->create();
        $target = User::factory()->create(['ldap_import' => 1]);

        $response = $this->actingAsForApi($actor)->patchJson(route('api.users.update', $target), [
            'ldap_import' => 0,
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertSame(0, (int) $target->fresh()->ldap_import);
    }
}
