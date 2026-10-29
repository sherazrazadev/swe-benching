<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Security;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class SingleRelationReferenceTest extends HiddenApiTestCase
{
    public function testWrongTypeReferenceOnSingleRelationIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'attack', 'relation' => '/hidden/bars/1'],
        ]);

        self::assertRefused($response);
    }

    public function testWrongTypeReferenceOnRelationCollectionIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'attack', 'relations' => ['/hidden/foos/1', '/hidden/bars/1']],
        ]);

        self::assertRefused($response);
    }

    public function testWrongTypeReferenceOnSingleRelationInPlainJsonIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
            'json' => ['name' => 'attack', 'relation' => '/hidden/bars/1'],
        ]);

        self::assertRefused($response);
    }
}
