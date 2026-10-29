<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Security;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class LegacyReferenceObjectTest extends HiddenApiTestCase
{
    public function testWrongTypeLegacyReferenceObjectIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
            'json' => ['name' => 'attack', 'relation' => ['iri' => '/hidden/bars/1']],
        ]);

        self::assertRefused($response);
    }

    public function testWrongTypeLegacyReferenceObjectInCollectionIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
            'json' => ['name' => 'attack', 'relations' => [['iri' => '/hidden/bars/1']]],
        ]);

        self::assertRefused($response);
    }
}
