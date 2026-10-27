<?php
use PHPUnit\Framework\TestCase;

/**
 * Base class: one server for the class, one scenario directory per test.
 */
abstract class AnetTestCase extends TestCase
{
    /** @var string[] */
    private $runtimes = [];

    public static function setUpBeforeClass(): void
    {
        AnetHarness::startServer();
    }

    public static function tearDownAfterClass(): void
    {
        AnetHarness::stopServer();
    }

    protected function tearDown(): void
    {
        foreach ($this->runtimes as $dir) {
            AnetHarness::cleanupRuntime($dir);
        }
        $this->runtimes = [];
    }

    protected function runtime(string $signatureKey = '8f3c2a9b7e6d5c4a1b0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
        ?array $transactions = null): string
    {
        $dir = AnetHarness::runtime($signatureKey, $transactions ?? AnetHarness::fixtures());
        $this->runtimes[] = $dir;
        return $dir;
    }

    protected function post(string $path, string $body, array $headers, string $runtime, $testUser = null,
        bool $testAdmin = false): array
    {
        return AnetHarness::request('POST', $path, $body, $headers, $runtime, $testUser, $testAdmin);
    }

    /** A refusal must be a client error, never a crash. */
    protected function assertClientError(array $response, string $why = ''): void
    {
        $this->assertGreaterThanOrEqual(400, $response['status'],
            'expected a client error' . ($why !== '' ? ' (' . $why . ')' : '') . ', got ' . $response['status']);
        $this->assertLessThan(500, $response['status'],
            'refusal must not be a server crash' . ($why !== '' ? ' (' . $why . ')' : ''));
    }

    protected function assertNoCredit(array $response, string $why = ''): void
    {
        $this->assertSame([], $response['wallet'],
            'the request must not change any wallet balance' . ($why !== '' ? ' (' . $why . ')' : ''));
    }

    /**
     * Only the gateway's own account and amount may be credited: no credit at all, or exactly
     * the transaction's account and amount once. Never a value the request supplied.
     */
    protected function assertOnlyGatewayCredit(array $response, int $usersId = 42, float $amount = 5.00,
        string $why = ''): void
    {
        $this->assertLessThan(500, $response['status'],
            'the request must not crash' . ($why !== '' ? ' (' . $why . ')' : ''));
        $this->assertLessThanOrEqual(1, count($response['wallet']),
            'one request must not credit twice' . ($why !== '' ? ' (' . $why . ')' : ''));
        foreach ($response['wallet'] as $row) {
            $this->assertSame($usersId, (int)($row['users_id'] ?? -1),
                'the credit must be for the gateway account, not a request value'
                . ($why !== '' ? ' (' . $why . ')' : ''));
            $this->assertEqualsWithDelta($amount, (float)($row['amount'] ?? -1), 0.001,
                'the credit must be the gateway amount, not a request value'
                . ($why !== '' ? ' (' . $why . ')' : ''));
        }
    }

    protected function assertCredited(array $response, int $usersId, float $amount, string $why = ''): void
    {
        $this->assertGreaterThanOrEqual(200, $response['status'],
            'a legitimate payment must be accepted' . ($why !== '' ? ' (' . $why . ')' : ''));
        $this->assertLessThan(400, $response['status'],
            'a legitimate payment must be accepted, got ' . $response['status']
            . ($why !== '' ? ' (' . $why . ')' : ''));
        $this->assertCount(1, $response['wallet'],
            'a legitimate payment must credit exactly once' . ($why !== '' ? ' (' . $why . ')' : ''));
        $this->assertSame($usersId, (int)$response['wallet'][0]['users_id'],
            'the credit must go to the paying account' . ($why !== '' ? ' (' . $why . ')' : ''));
        $this->assertEqualsWithDelta($amount, (float)$response['wallet'][0]['amount'], 0.001,
            'the credit must be the payment amount' . ($why !== '' ? ' (' . $why . ')' : ''));
    }
}
