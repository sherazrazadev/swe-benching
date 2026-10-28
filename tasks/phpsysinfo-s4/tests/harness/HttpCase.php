<?php
/**
 * Verifier-owned fixtures for the hidden suites.
 *
 * The product under test is whatever the agent left in /workspace. These helpers only write the
 * product's configuration file and speak HTTP to the product over loopback; they never call into
 * the product's own code to compute an expected value.
 */

class AssertionFailure extends Exception
{
}

abstract class HttpCase
{
    /** @var string */
    protected static $workspace = '/workspace';
    /** @var int */
    protected static $port = 18090;

    public static function configure($workspace, $port)
    {
        self::$workspace = $workspace;
        self::$port = $port;
    }

    public function setUp()
    {
    }

    public function tearDown()
    {
    }

    /**
     * Write the product's configuration file with the given allow list and (optionally) the
     * addresses of trusted reverse proxies.
     */
    protected function useConfig($allowed, $proxies = null)
    {
        $ini = file_get_contents(__DIR__.'/base.ini');
        if ($ini === false) {
            throw new AssertionFailure('cannot read the verifier configuration template');
        }
        $ini = preg_replace('/^ALLOWED=.*$/m', 'ALLOWED="'.$allowed.'"', $ini, 1);
        if ($proxies !== null) {
            $ini = preg_replace(
                '/^(ALLOWED="[^"]*")$/m',
                "$1\nTRUSTED_PROXIES=\"".$proxies.'"',
                $ini,
                1
            );
        }
        $path = self::$workspace.'/phpsysinfo.ini';
        if (file_put_contents($path, $ini) === false) {
            throw new AssertionFailure('cannot write '.$path);
        }
    }

    /**
     * One plain HTTP/1.0 request to the product. Returns status, body and the raw response head.
     */
    protected function get($path, array $headers = array())
    {
        $fp = @fsockopen('127.0.0.1', self::$port, $errno, $errstr, 5);
        if (!$fp) {
            throw new AssertionFailure('cannot connect to the product: '.$errstr);
        }
        stream_set_timeout($fp, 20);
        $request = "GET ".$path." HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n";
        foreach ($headers as $name => $value) {
            $request .= $name.': '.$value."\r\n";
        }
        $request .= "\r\n";
        fwrite($fp, $request);
        $raw = stream_get_contents($fp);
        fclose($fp);
        if ($raw === false) {
            throw new AssertionFailure('the product sent no response');
        }
        $split = explode("\r\n\r\n", $raw, 2);
        $head = $split[0];
        $body = isset($split[1]) ? $split[1] : '';
        $status = 0;
        if (preg_match('#^HTTP/\d\.\d\s+(\d{3})#', $head, $m)) {
            $status = (int) $m[1];
        }
        return array('status' => $status, 'body' => $body, 'head' => $head);
    }

    /**
     * Assert that the response refuses the request: none of the protected markers appears, and the
     * client is told no (a 4xx status or the product's refusal wording). One exact status is never
     * required.
     */
    protected function assertBlocked(array $response, array $markers, $what)
    {
        foreach ($markers as $marker) {
            if (strpos($response['body'], $marker) !== false) {
                throw new AssertionFailure($what.': protected information was returned to an unlisted client');
            }
        }
        $clientError = ($response['status'] >= 400) && ($response['status'] < 500);
        $refusal = (bool) preg_match(
            '/not allowed|not permitted|forbidden|denied|unauthori[sz]ed|access refused|no access/i',
            $response['body']
        );
        if (!$clientError && !$refusal) {
            throw new AssertionFailure(
                $what.': the request was not refused (HTTP '.$response['status'].')'
            );
        }
    }

    /** Assert that an admitted client still receives the product's output. */
    protected function assertServed(array $response, $marker, $what)
    {
        if ($response['status'] >= 400) {
            throw new AssertionFailure($what.': an admitted client got HTTP '.$response['status']);
        }
        if (strpos($response['body'], $marker) === false) {
            throw new AssertionFailure($what.': the expected output is missing');
        }
    }

    protected function assertContains($needle, $haystack, $what)
    {
        if (strpos($haystack, $needle) === false) {
            throw new AssertionFailure($what.': missing '.$needle);
        }
    }
}
