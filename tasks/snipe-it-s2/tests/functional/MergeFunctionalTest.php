<?php

namespace Tests\Feature\Hidden\Functional;

use App\Models\Asset;
use App\Models\User;
use Tests\TestCase;

class MergeFunctionalTest extends TestCase
{
    public function test_admin_can_merge_regular_users()
    {
        $actor = User::factory()->admin()->create();
        $source = User::factory()->create();
        $target = User::factory()->create();
        $asset = Asset::factory()->assignedToUser($source)->create();

        $response = $this->actingAs($actor)->post(route('users.merge.save'), [
            'ids_to_merge' => [$source->id],
            'merge_into_id' => $target->id,
        ]);

        $response->assertRedirect(route('users.index'))->assertSessionHas('success');
        $this->assertSoftDeleted($source);
        $this->assertSame($target->id, $asset->fresh()->assigned_to);
    }
}
