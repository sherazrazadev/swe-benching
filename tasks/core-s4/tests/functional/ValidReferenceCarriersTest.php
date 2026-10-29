<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Functional;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class ValidReferenceCarriersTest extends HiddenApiTestCase
{
    public function testNestedNodeReferenceOfTheDeclaredTypeIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'draft', 'relation' => ['@id' => '/hidden/foos/1']],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame('/hidden/foos/1', $response->toArray()['relation']);
    }

    public function testLegacyReferenceObjectOfTheDeclaredTypeIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
            'json' => ['name' => 'draft', 'relation' => ['iri' => '/hidden/foos/1']],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame('/hidden/foos/1', $response->toArray()['relation']);
    }
}
