<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Support;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\Metadata\Post;

#[ApiResource(operations: [
    new Post(uriTemplate: '/hidden/targets{._format}', processor: [self::class, 'process']),
    new Get(uriTemplate: '/hidden/targets/{id}{._format}', provider: [self::class, 'provide']),
])]
class Target
{
    /**
     * Objects handed to the write processor by accepted requests.
     *
     * @var list<object>
     */
    private static array $accepted = [];

    #[ApiProperty(identifier: true)]
    public ?int $id = null;

    public ?string $name = null;

    /** @var Foo|null */
    public $relation;

    /** @var Foo[]|null */
    public $relations = [];

    public static function provide(Operation $operation, array $uriVariables = [], array $context = []): self
    {
        $target = new self();
        $target->id = (int) ($uriVariables['id'] ?? 1);
        $target->name = 'stored';

        return $target;
    }

    public static function resetAccepted(): void
    {
        self::$accepted = [];
    }

    /**
     * @return list<object>
     */
    public static function accepted(): array
    {
        return self::$accepted;
    }

    public static function process(mixed $data): mixed
    {
        if ($data instanceof self && null === $data->id) {
            $data->id = 1;
        }

        self::$accepted[] = $data;

        return $data;
    }
}
