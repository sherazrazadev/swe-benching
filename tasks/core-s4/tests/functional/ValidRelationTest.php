<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Functional;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class ValidRelationTest extends HiddenApiTestCase
{
    public function testReferenceOfTheDeclaredTypeIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'draft', 'relation' => '/hidden/foos/1'],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame('/hidden/foos/1', $response->toArray()['relation']);
    }

    public function testReferenceOfTheDeclaredTypeInACollectionIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'draft', 'relations' => ['/hidden/foos/1', '/hidden/foos/2']],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame(['/hidden/foos/1', '/hidden/foos/2'], $response->toArray()['relations']);
    }

    public function testReferenceOfTheDeclaredTypeInPlainJsonIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
            'json' => ['name' => 'draft', 'relation' => '/hidden/foos/1'],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame('/hidden/foos/1', $response->toArray()['relation']);
    }

    public function testWriteWithoutAnyRelationIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'draft'],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame('draft', $response->toArray()['name']);
    }
}
