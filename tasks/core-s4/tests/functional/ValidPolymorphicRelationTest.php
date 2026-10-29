<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Functional;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class ValidPolymorphicRelationTest extends HiddenApiTestCase
{
    public function testConcreteSubtypeOfAnAbstractDeclaredTypeIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/poly-targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'draft', 'thing' => '/hidden/concrete-things/1'],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame('/hidden/concrete-things/1', $response->toArray()['thing']);
    }

    public function testConcreteSubtypeOfAnAbstractDeclaredTypeInACollectionIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/poly-targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => ['name' => 'draft', 'things' => ['/hidden/concrete-things/1']],
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        self::assertSame(['/hidden/concrete-things/1'], $response->toArray()['things']);
    }
}
