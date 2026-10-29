<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Security;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class JsonApiLinkageTest extends HiddenApiTestCase
{
    public function testWrongTypeToOneLinkageIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/vnd.api+json', 'Accept' => 'application/vnd.api+json'],
            'json' => ['data' => [
                'type' => 'Target',
                'attributes' => ['name' => 'attack'],
                'relationships' => [
                    'relation' => ['data' => ['type' => 'Bar', 'id' => '/hidden/bars/1']],
                ],
            ]],
        ]);

        self::assertRefused($response);
    }

    public function testLinkageClaimingTheDeclaredTypeIsRefusedWhenTheTargetIsAnotherType(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/vnd.api+json', 'Accept' => 'application/vnd.api+json'],
            'json' => ['data' => [
                'type' => 'Target',
                'attributes' => ['name' => 'attack'],
                'relationships' => [
                    'relation' => ['data' => ['type' => 'Foo', 'id' => '/hidden/bars/1']],
                ],
            ]],
        ]);

        self::assertRefused($response);
    }

    public function testWrongTypeToManyLinkageIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/vnd.api+json', 'Accept' => 'application/vnd.api+json'],
            'json' => ['data' => [
                'type' => 'Target',
                'attributes' => ['name' => 'attack'],
                'relationships' => [
                    'relations' => ['data' => [['type' => 'Foo', 'id' => '/hidden/bars/1']]],
                ],
            ]],
        ]);

        self::assertRefused($response);
    }
}
