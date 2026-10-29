<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Support;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\Operation;

#[ApiResource(operations: [new Get(uriTemplate: '/hidden/foos/{id}{._format}', provider: [self::class, 'provide'])])]
class Foo
{
    public function __construct(
        #[ApiProperty(identifier: true)]
        public readonly int $id,
        public readonly string $name = 'foo',
    ) {
    }

    public static function provide(Operation $operation, array $uriVariables = [], array $context = []): self
    {
        return new self((int) ($uriVariables['id'] ?? 1));
    }
}
