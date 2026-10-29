<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Functional;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class ValidWholeDocumentReferenceTest extends HiddenApiTestCase
{
    public function testReferenceOfTheDeclaredTypeAsWholeDocumentIsAccepted(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => '/hidden/targets/1',
        ]);

        self::assertSame(201, $response->getStatusCode(), $response->getContent(false));
        $data = $response->toArray();
        self::assertSame('/hidden/targets/1', $data['@id']);
        self::assertSame('Target', $data['@type']);
    }
}
