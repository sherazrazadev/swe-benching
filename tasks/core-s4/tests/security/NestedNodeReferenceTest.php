<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Security;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class NestedNodeReferenceTest extends HiddenApiTestCase
{
    public function testWrongTypeNestedNodeReferenceIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'attack', 'relation' => ['@id' => '/hidden/bars/1']],
        ]);

        self::assertRefused($response);
    }

    public function testWrongTypeNestedNodeReferenceInCollectionIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'attack', 'relations' => [['@id' => '/hidden/bars/1']]],
        ]);

        self::assertRefused($response);
    }
}
