<?php

namespace Tests\Feature\Hidden\Functional;

use App\Models\User;
use Tests\TestCase;

class QuickActivationFunctionalTest extends TestCase
{
    public function test_non_admin_can_disable_regular_user_via_activation_action()
    {
        $actor = User::factory()->viewUsers()->editUsers()->create();
        $target = User::factory()->create(['activated' => 1, 'ldap_import' => 0]);

        $this->actingAs($actor)->post(route('users/bulkedit'), [
            'ids' => [$target->id],
            'bulk_actions' => 'activate',
            'status' => 'inactive',
            'ldap_import' => '1',
        ])->assertRedirect(route('users.index'));

        $this->assertFalse((bool) $target->fresh()->activated);
        $this->assertSame(1, (int) $target->fresh()->ldap_import);
    }
}
