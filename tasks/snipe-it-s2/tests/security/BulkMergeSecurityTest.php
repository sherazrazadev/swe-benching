<?php

namespace Tests\Feature\Hidden\Security;

use App\Models\User;
use Tests\TestCase;

class BulkMergeSecurityTest extends TestCase
{
    public function test_edit_only_actor_cannot_merge_ordinary_user()
    {
        $actor = User::factory()->editUsers()->create();
        $source = User::factory()->create();
        $target = User::factory()->create();

        $response = $this->actingAs($actor)->post(route('users.merge.save'), [
            'ids_to_merge' => [$source->id],
            'merge_into_id' => $target->id,
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertNotSoftDeleted($source);
    }

    public function test_admin_cannot_merge_superuser()
    {
        $actor = User::factory()->admin()->create();
        $source = User::factory()->superuser()->create();
        $target = User::factory()->create();

        $response = $this->actingAs($actor)->post(route('users.merge.save'), [
            'ids_to_merge' => [$source->id],
            'merge_into_id' => $target->id,
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertNotSoftDeleted($source);
    }

    public function test_delete_authorised_actor_cannot_merge_accounts_they_may_not_administer()
    {
        $actor = User::factory()->editUsers()->deleteUsers()->create();
        $source = User::factory()->superuser()->create();
        $target = User::factory()->create();

        $response = $this->actingAs($actor)->post(route('users.merge.save'), [
            'ids_to_merge' => [$source->id],
            'merge_into_id' => $target->id,
        ]);

        $this->assertLessThan(500, $response->status());
        $this->assertNotSoftDeleted($source);
    }
}
