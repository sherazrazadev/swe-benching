<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Support;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\Operation;

#[ApiResource(operations: [new Get(uriTemplate: '/hidden/concrete-things/{id}{._format}', provider: [self::class, 'provide'])])]
class ConcreteThing extends AbstractThing
{
    public function __construct(int $id)
    {
        parent::__construct($id, 'concrete');
    }

    public static function provide(Operation $operation, array $uriVariables = [], array $context = []): self
    {
        return new self((int) ($uriVariables['id'] ?? 1));
    }
}
