<?php

namespace Tests\Feature\Hidden\Functional;

use App\Models\Group;
use App\Models\User;
use Tests\TestCase;

class BulkEditFunctionalTest extends TestCase
{
    public function test_non_admin_can_disable_regular_user()
    {
        $actor = User::factory()->editUsers()->create();
        $target = User::factory()->create(['activated' => 1]);

        $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$target->id],
            'activated' => '0',
        ])->assertRedirect(route('users.index'));

        $this->assertFalse((bool) $target->fresh()->activated);
    }

    public function test_non_admin_can_allow_password_management_on_regular_user()
    {
        $actor = User::factory()->editUsers()->create();
        $target = User::factory()->create(['ldap_import' => 1]);

        $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$target->id],
            'ldap_import' => '0',
        ])->assertRedirect(route('users.index'));

        $this->assertSame(0, (int) $target->fresh()->ldap_import);
    }

    public function test_non_admin_can_enable_ldap_password_management_on_regular_user()
    {
        $actor = User::factory()->editUsers()->create();
        $target = User::factory()->create(['ldap_import' => 0]);

        $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$target->id],
            'ldap_import' => '1',
        ])->assertRedirect(route('users.index'));

        $this->assertSame(1, (int) $target->fresh()->ldap_import);
    }

    public function test_non_auth_fields_still_update_for_protected_targets()
    {
        $actor = User::factory()->editUsers()->create();
        $admin = User::factory()->admin()->create(['city' => 'Springfield', 'activated' => 1]);
        $superuser = User::factory()->superuser()->create(['city' => 'Springfield', 'activated' => 1]);

        $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$admin->id, $superuser->id],
            'city' => 'Shelbyville',
            'display_name' => 'Renamed',
        ])->assertRedirect(route('users.index'));

        $this->assertSame('Shelbyville', $admin->fresh()->city);
        $this->assertSame('Renamed', $admin->fresh()->display_name);
        $this->assertSame('Shelbyville', $superuser->fresh()->city);
        $this->assertSame('Renamed', $superuser->fresh()->display_name);
    }

    public function test_groups_still_sync_for_editable_targets()
    {
        $actor = User::factory()->editUsers()->create();
        $target = User::factory()->create();
        $group = Group::factory()->create();

        $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$target->id],
            'groups' => [$group->id],
        ])->assertRedirect(route('users.index'));

        $this->assertTrue($target->fresh()->groups->contains($group));
    }

    public function test_admin_can_disable_regular_user()
    {
        $actor = User::factory()->admin()->create();
        $target = User::factory()->create(['activated' => 1]);

        $this->actingAs($actor)->post(route('users/bulkeditsave'), [
            'ids' => [$target->id],
            'activated' => '0',
        ])->assertRedirect(route('users.index'));

        $this->assertFalse((bool) $target->fresh()->activated);
    }
}
