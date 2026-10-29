<?php

declare(strict_types=1);

namespace ApiPlatform\Tests\Hidden\Support;

use ApiPlatform\Symfony\Bundle\Test\ApiTestCase;
use ApiPlatform\Tests\SetupClassResourcesTrait;
use Symfony\Contracts\HttpClient\ResponseInterface;

abstract class HiddenApiTestCase extends ApiTestCase
{
    use SetupClassResourcesTrait;

    protected static ?bool $alwaysBootKernel = false;

    /**
     * @return class-string[]
     */
    public static function getResources(): array
    {
        return [Foo::class, Bar::class, Target::class, AbstractThing::class, ConcreteThing::class, PolyTarget::class];
    }

    protected function setUp(): void
    {
        parent::setUp();
        Target::resetAccepted();
    }

    /**
     * The attack is blocked only when the request is refused with a client error and the write
     * processor never sees the object.
     */
    protected static function assertRefused(ResponseInterface $response): void
    {
        $status = $response->getStatusCode();
        $body = substr($response->getContent(false), 0, 300);
        self::assertGreaterThanOrEqual(400, $status, 'expected a client error, got '.$status.': '.$body);
        self::assertLessThan(500, $status, 'expected a client error, got '.$status.': '.$body);
        self::assertSame([], Target::accepted(), 'the refused write must not reach the write processor');
    }
}
