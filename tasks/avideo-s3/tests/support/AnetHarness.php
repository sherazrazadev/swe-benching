<?php
/**
 * Shared harness for the hidden suites.
 *
 * Every suite drives the plugin's real HTTP entry points through the PHP built-in server running
 * the checkout. The platform boot, the wallet plugin and the outbound gateway call are answered
 * by small stand-ins (see support/configuration.php); nothing here re-implements the plugin logic
 * under test, and every expected value is computed in the suite itself.
 */
final class AnetHarness
{
    public static $root;

    private static $process = null;
    private static $port = 0;
    private static $logFile = null;

    public static function boot(): void
    {
        $root = getenv('CWE_APP_ROOT');
        if (empty($root)) {
            $root = '/workspace';
        }
        self::$root = rtrim($root, '/');
    }

    public static function startServer(): void
    {
        if (self::$process !== null) {
            return;
        }
        self::boot();
        $lastError = '';
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $port = self::freePort();
            self::$logFile = tempnam(sys_get_temp_dir(), 'anet-server-');
            $cmd = [PHP_BINARY, '-d', 'error_reporting=0', '-d', 'display_errors=0',
                '-S', '127.0.0.1:' . $port, '-t', self::$root];
            $descriptors = [
                0 => ['file', '/dev/null', 'r'],
                1 => ['file', self::$logFile, 'a'],
                2 => ['file', self::$logFile, 'a'],
            ];
            putenv('CWE_APP_ROOT=' . self::$root);
            $process = proc_open($cmd, $descriptors, $pipes);
            if (!is_resource($process)) {
                $lastError = 'proc_open failed';
                continue;
            }
            $deadline = microtime(true) + 5.0;
            $up = false;
            while (microtime(true) < $deadline) {
                $socket = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.2);
                if (is_resource($socket)) {
                    fclose($socket);
                    $up = true;
                    break;
                }
                usleep(50000);
            }
            if ($up) {
                self::$process = $process;
                self::$port = $port;
                return;
            }
            $lastError = (string)@file_get_contents((string)self::$logFile);
            proc_terminate($process);
            proc_close($process);
        }
        throw new RuntimeException('harness: could not start the server: ' . $lastError);
    }

    public static function stopServer(): void
    {
        if (self::$process === null) {
            return;
        }
        proc_terminate(self::$process);
        proc_close(self::$process);
        self::$process = null;
        self::$port = 0;
    }

    private static function freePort(): int
    {
        $server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        if (!is_resource($server)) {
            throw new RuntimeException('harness: no free port: ' . $errstr);
        }
        $name = stream_socket_get_name($server, false);
        fclose($server);
        $parts = explode(':', (string)$name);
        return (int)end($parts);
    }

    /**
     * Create one scenario directory: the plugin configuration and the gateway's transaction
     * records. Returns the directory path, which each request tells the boot to use.
     */
    public static function runtime(string $signatureKey, array $transactions): string
    {
        $dir = sys_get_temp_dir() . '/anet-rt-' . bin2hex(random_bytes(6));
        if (!mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('harness: cannot create runtime dir');
        }
        file_put_contents($dir . '/plugin.json', json_encode([
            'apiLoginId' => 'harness-login',
            'transactionKey' => 'harness-transaction-key',
            'signatureKey' => $signatureKey,
            'sandbox' => true,
        ]));
        file_put_contents($dir . '/transactions.json', json_encode($transactions));
        file_put_contents($dir . '/wallet.log', '');
        return $dir;
    }

    public static function cleanupRuntime(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (glob($dir . '/*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($dir);
    }

    /** Transactions answered by the gateway stand-in. */
    public static function fixtures(): array
    {
        return [
            // Approved, status spelled in the lower case the gateway returns for settled charges.
            '60000000001' => [
                'status' => 'settledsuccessfully',
                'responseCode' => '1',
                'amount' => 5.00,
                'users_id' => 42,
                'plans_id' => 0,
                'email' => 'buyer42@example.test',
                'description' => json_encode(['users_id' => 42, 'plans_id' => 0]),
            ],
            // The gateway declined this transaction.
            '60000000002' => [
                'status' => 'declined',
                'responseCode' => '2',
                'amount' => 5.00,
                'users_id' => 42,
                'plans_id' => 0,
                'email' => 'buyer42@example.test',
                'description' => json_encode(['users_id' => 42, 'plans_id' => 0]),
            ],
            // Approved, status spelled the way the plugin's constants are written today.
            '60000000003' => [
                'status' => 'settledSuccessfully',
                'responseCode' => '1',
                'amount' => 5.00,
                'users_id' => 42,
                'plans_id' => 0,
                'email' => 'buyer42@example.test',
                'description' => json_encode(['users_id' => 42, 'plans_id' => 0]),
            ],
            // A second buyer and amount, for the legitimate multi-account flows.
            '60000000004' => [
                'status' => 'settledSuccessfully',
                'responseCode' => '1',
                'amount' => 7.50,
                'users_id' => 43,
                'plans_id' => 0,
                'email' => 'buyer43@example.test',
                'description' => json_encode(['users_id' => 43, 'plans_id' => 0]),
            ],
        ];
    }

    /** HMAC-SHA512 over the raw body, keyed with the configured signature key as sent. */
    public static function sign(string $rawBody, string $signatureKey): string
    {
        return 'sha512=' . hash_hmac('sha512', $rawBody, $signatureKey);
    }

    /** A one-time payment notification body in the gateway's JSON shape. */
    public static function notification(string $transactionId, $usersId, $amount, $responseCode = '1',
        string $eventType = 'net.authorize.payment.authcapture.created'): string
    {
        $payload = ['id' => $transactionId, 'currencyCode' => 'USD'];
        if ($usersId !== null) {
            $payload['metadata'] = ['users_id' => $usersId, 'plans_id' => 0];
        }
        if ($amount !== null) {
            $payload['amount'] = $amount;
        }
        if ($responseCode !== null) {
            $payload['responseCode'] = $responseCode;
        }
        return json_encode(['eventType' => $eventType, 'payload' => $payload]);
    }

    /**
     * Send one request to the running server and return the status, the raw body and every
     * wallet balance change the request caused.
     */
    public static function request(string $method, string $path, string $body, array $headers,
        string $runtime, $testUser = null, bool $testAdmin = false): array
    {
        self::startServer();
        file_put_contents($runtime . '/wallet.log', '');
        $headers['X-ANET-Runtime'] = $runtime;
        if ($testUser !== null) {
            $headers['X-Test-User'] = (string)$testUser;
        }
        if ($testAdmin) {
            $headers['X-Test-Admin'] = '1';
        }
        $lines = [];
        foreach ($headers as $name => $value) {
            $lines[] = $name . ': ' . $value;
        }
        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $lines),
                'content' => $body,
                'ignore_errors' => true,
                'timeout' => 15,
            ],
        ]);
        $response = @file_get_contents('http://127.0.0.1:' . self::$port . $path, false, $context);
        $status = 0;
        foreach ($http_response_header ?? [] as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $match)) {
                $status = (int)$match[1];
            }
        }
        return [
            'status' => $status,
            'body' => $response === false ? '' : $response,
            'wallet' => self::wallet($runtime),
        ];
    }

    public static function wallet(string $runtime): array
    {
        $out = [];
        $file = $runtime . '/wallet.log';
        if (!is_file($file)) {
            return $out;
        }
        foreach (explode("\n", (string)file_get_contents($file)) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $row = json_decode($line, true);
            if (is_array($row)) {
                $out[] = $row;
            }
        }
        return $out;
    }
}
