<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Functional;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class ValidJsonApiLinkageTest extends HiddenApiTestCase
{
    public function testToOneLinkageOfTheDeclaredTypeIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/vnd.api+json', 'Accept' => 'application/vnd.api+json'],
            'json' => ['data' => [
                'type' => 'Target',
                'attributes' => ['name' => 'draft'],
                'relationships' => [
                    'relation' => ['data' => ['type' => 'Foo', 'id' => '/hidden/foos/1']],
                ],
            ]],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame('/hidden/foos/1', $response->toArray()['data']['relationships']['relation']['data']['id']);
    }

    public function testToManyLinkageOfTheDeclaredTypeIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/vnd.api+json', 'Accept' => 'application/vnd.api+json'],
            'json' => ['data' => [
                'type' => 'Target',
                'attributes' => ['name' => 'draft'],
                'relationships' => [
                    'relations' => ['data' => [['type' => 'Foo', 'id' => '/hidden/foos/1']]],
                ],
            ]],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame('/hidden/foos/1', $response->toArray()['data']['relationships']['relations']['data'][0]['id']);
    }
}
