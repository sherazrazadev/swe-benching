<?php

namespace Tests\Feature\Hidden\Functional;

use App\Models\User;
use Tests\TestCase;

class ToggleActivationFunctionalTest extends TestCase
{
    public function test_non_admin_can_disable_regular_user_via_toggle()
    {
        $actor = User::factory()->editUsers()->create();
        $target = User::factory()->create(['activated' => 1, 'ldap_import' => 0]);

        $this->actingAs($actor)->post(route('users.toggle_active', $target), [
            'activated' => '0',
            'ldap_import' => '1',
        ]);

        $this->assertFalse((bool) $target->fresh()->activated);
        $this->assertSame(1, (int) $target->fresh()->ldap_import);
    }
}
