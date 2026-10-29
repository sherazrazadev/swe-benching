<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Support;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Post;

#[ApiResource(operations: [new Post(uriTemplate: '/hidden/poly-targets{._format}')])]
class PolyTarget
{
    public ?string $name = null;

    /** @var AbstractThing|null */
    public $thing;

    /** @var AbstractThing[]|null */
    public $things = [];
}
