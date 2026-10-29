<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Security;

use ApiPlatform\Tests\Hidden\Support\HiddenApiTestCase;

final class WholeDocumentReferenceTest extends HiddenApiTestCase
{
    public function testWrongTypeReferenceAsWholeDocumentIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/ld+json', 'Accept' => 'application/ld+json'],
            'json' => '/hidden/bars/1',
        ]);

        self::assertRefused($response);
    }

    public function testWrongTypeReferenceAsWholeDocumentInPlainJsonIsRefused(): void
    {
        $response = self::createClient()->request('POST', '/hidden/targets', [
            'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
            'json' => '/hidden/bars/1',
        ]);

        self::assertRefused($response);
    }
}
