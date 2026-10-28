<?php

namespace Tests\Feature\Hidden\Functional;

use App\Models\User;
use Tests\TestCase;

class SingleUserFunctionalTest extends TestCase
{
    public function test_non_admin_can_disable_regular_user_via_single_update()
    {
        $actor = User::factory()->editUsers()->create();
        $target = User::factory()->create(['activated' => 1]);

        $response = $this->actingAs($actor)->put(route('users.update', $target), [
            'first_name' => $target->first_name,
            'username' => $target->username,
            'activated' => '0',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertFalse((bool) $target->fresh()->activated);
    }

    public function test_admin_can_enable_regular_user_via_single_update()
    {
        $actor = User::factory()->admin()->create();
        $target = User::factory()->create(['activated' => 0]);

        $response = $this->actingAs($actor)->put(route('users.update', $target), [
            'first_name' => $target->first_name,
            'username' => $target->username,
            'activated' => '1',
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertTrue((bool) $target->fresh()->activated);
    }
}
