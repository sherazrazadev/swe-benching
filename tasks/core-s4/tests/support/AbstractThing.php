<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Support;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\Operation;

#[ApiResource(operations: [new Get(uriTemplate: '/hidden/abstract-things/{id}{._format}', provider: [self::class, 'provide'])])]
abstract class AbstractThing
{
    public function __construct(
        #[ApiProperty(identifier: true)]
        public readonly int $id,
        public readonly string $kind = 'abstract',
    ) {
    }

    public static function provide(Operation $operation, array $uriVariables = [], array $context = []): self
    {
        return new ConcreteThing((int) ($uriVariables['id'] ?? 1));
    }
}
