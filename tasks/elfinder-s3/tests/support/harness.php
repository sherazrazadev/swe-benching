<?php
/**
 * Shared harness for the hidden suites.
 *
 * It starts the real connector (the library's public HTTP front end) in front of a throw-away
 * fixture and talks to it over HTTP. Every expected value (hashes, paths, marker strings) is
 * computed here, never by product code, so a hardened implementation cannot break the harness.
 */

class TestFailure extends Exception
{
}

function assert_true($cond, $msg)
{
    if (!$cond) {
        throw new TestFailure($msg);
    }
}

function assert_not_contains($needle, $haystack, $msg)
{
    if (strpos($haystack, $needle) !== false) {
        throw new TestFailure($msg);
    }
}

function assert_contains($needle, $haystack, $msg)
{
    if (strpos($haystack, $needle) === false) {
        throw new TestFailure($msg);
    }
}

function assert_file_missing($path, $msg)
{
    if (file_exists($path) || is_link($path)) {
        throw new TestFailure($msg . ' (' . basename($path) . ' exists)');
    }
}

function assert_file_present($path, $msg)
{
    if (!file_exists($path)) {
        throw new TestFailure($msg . ' (' . basename($path) . ' is missing)');
    }
}

/** A response must never be a server-side failure (a crash is not a refusal). */
function assert_not_server_error($resp, $msg)
{
    if ($resp['status'] === 0 || $resp['status'] >= 500) {
        throw new TestFailure($msg . ' (HTTP status ' . $resp['status'] . ')');
    }
    if (preg_match('/Fatal error|Uncaught|Parse error|Stack trace|Warning:|Notice:|\{main\}/i', $resp['body'])) {
        throw new TestFailure($msg . ' (the response is a runtime error page)');
    }
}

class ElFinderTestContext
{
    public $base;
    public $root;
    public $outside;
    public $tmp;
    public $web;
    public $port = 0;

    private $proc = null;
    private $log;

    public function __construct()
    {
        $this->base = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR
            . 'ef-' . getmypid() . '-' . bin2hex(random_bytes(4));
        $this->root = $this->base . '/root';
        $this->outside = $this->base . '/outside';
        $this->tmp = $this->base . '/tmp';
        $this->web = $this->base . '/web';
        $this->log = $this->base . '/server.log';
        foreach (array($this->base, $this->root, $this->outside, $this->tmp, $this->web) as $d) {
            $this->mkdir($d);
        }
        copy(__DIR__ . '/web/connector.php', $this->web . '/connector.php');
        $this->startServer();
    }

    public function uniq()
    {
        return bin2hex(random_bytes(6));
    }

    public function mkdir($dir)
    {
        if (!is_dir($dir) && !mkdir($dir, 0777, true)) {
            throw new Exception('cannot create fixture directory ' . $dir);
        }
    }

    private function startServer()
    {
        $env = array(
            'PATH' => getenv('PATH') ?: '/usr/local/bin:/usr/bin:/bin',
            'HOME' => $this->base,
            'LANG' => 'C.UTF-8',
            'TMPDIR' => $this->base,
            'EF_FIXTURE_ROOT' => $this->root,
            'EF_FIXTURE_TMP' => $this->tmp,
            'EF_PRODUCT_ROOT' => getenv('EF_PRODUCT_ROOT') ?: '/workspace',
        );
        $desc = array(
            0 => array('file', '/dev/null', 'r'),
            1 => array('file', $this->log, 'a'),
            2 => array('file', $this->log, 'a'),
        );
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $port = random_int(20000, 45000);
            $cmd = array(PHP_BINARY, '-S', '127.0.0.1:' . $port, '-t', $this->web);
            $proc = @proc_open($cmd, $desc, $pipes, $this->base, $env);
            if (!is_resource($proc)) {
                continue;
            }
            $ready = false;
            for ($i = 0; $i < 120; $i++) {
                $status = proc_get_status($proc);
                if (!$status['running']) {
                    break;
                }
                $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.1);
                if ($fp) {
                    fclose($fp);
                    $ready = true;
                    break;
                }
                usleep(50000);
            }
            if ($ready) {
                $this->proc = $proc;
                $this->port = $port;
                return;
            }
            @proc_terminate($proc, 9);
            @proc_close($proc);
        }
        throw new Exception('could not start the PHP built-in server for the fixture');
    }

    public function stop()
    {
        if (is_resource($this->proc)) {
            @proc_terminate($this->proc, 9);
            @proc_close($this->proc);
            $this->proc = null;
        }
        $this->rmTree($this->base);
    }

    /**
     * Reset the fixture to an empty state. Anything an earlier test managed to create in the
     * parent of the storage root is removed here too, so tests never depend on each other.
     */
    public function fresh()
    {
        foreach ((array)scandir($this->base) as $entry) {
            if ($entry === '.' || $entry === '..' || $entry === 'server.log'
                || $entry === 'root' || $entry === 'outside' || $entry === 'tmp' || $entry === 'web') {
                continue;
            }
            $this->rmTree($this->base . '/' . $entry);
        }
        foreach (array($this->root, $this->outside, $this->tmp) as $d) {
            $this->rmTree($d);
            $this->mkdir($d);
        }
        $this->mkdir($this->root . '/sub');
        $this->mkdir($this->root . '/sub/deep');
        $this->mkdir($this->tmp . '/sub');
        file_put_contents($this->root . '/seed.txt', "fixture seed\n");
    }

    public function rmTree($path)
    {
        if (is_link($path) || is_file($path)) {
            @unlink($path);
            return;
        }
        if (!is_dir($path)) {
            return;
        }
        foreach ((array)scandir($path) as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $this->rmTree($path . '/' . $entry);
        }
        @rmdir($path);
    }

    /** Hash the client uses for a path relative to the single local volume. */
    public function hash($rel)
    {
        $enc = ($rel === '/' || $rel === '') ? '/' : ltrim($rel, '/');
        $b = strtr(base64_encode($enc), '+/=', '-_.');
        return 'l1_' . rtrim($b, '.');
    }

    public function get($params)
    {
        $query = http_build_query($params, '', '&', PHP_QUERY_RFC3986);
        return $this->request('GET', '/connector.php?' . $query);
    }

    public function postMultipart($fields, $fileField, $file)
    {
        $boundary = '----ef' . bin2hex(random_bytes(12));
        $body = '';
        foreach ($fields as $name => $value) {
            $body .= '--' . $boundary . "\r\n";
            $body .= 'Content-Disposition: form-data; name="' . $name . '"' . "\r\n\r\n";
            $body .= $value . "\r\n";
        }
        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="' . $fileField . '"; filename="' . $file['filename'] . '"' . "\r\n";
        $body .= 'Content-Type: ' . $file['type'] . "\r\n\r\n";
        $body .= $file['content'] . "\r\n";
        $body .= '--' . $boundary . "--\r\n";
        return $this->request('POST', '/connector.php', array(
            'Content-Type' => 'multipart/form-data; boundary=' . $boundary,
        ), $body);
    }

    private function request($method, $path, $headers = array(), $body = '')
    {
        $fp = @fsockopen('127.0.0.1', $this->port, $errno, $errstr, 5);
        if (!$fp) {
            throw new Exception('cannot connect to the connector: ' . $errstr);
        }
        stream_set_timeout($fp, 15);
        $req = $method . ' ' . $path . " HTTP/1.1\r\n";
        $req .= "Host: 127.0.0.1\r\nConnection: close\r\n";
        foreach ($headers as $name => $value) {
            $req .= $name . ': ' . $value . "\r\n";
        }
        $req .= 'Content-Length: ' . strlen($body) . "\r\n\r\n" . $body;
        fwrite($fp, $req);
        $raw = '';
        while (!feof($fp)) {
            $chunk = fread($fp, 8192);
            if ($chunk === false) {
                break;
            }
            $raw .= $chunk;
        }
        fclose($fp);

        $split = strpos($raw, "\r\n\r\n");
        $head = ($split === false) ? $raw : substr($raw, 0, $split);
        $payload = ($split === false) ? '' : substr($raw, $split + 4);
        $status = 0;
        if (preg_match('#^HTTP/[\d.x]+ (\d{3})#i', $head, $m)) {
            $status = (int)$m[1];
        }
        if (stripos($head, 'Transfer-Encoding: chunked') !== false) {
            $payload = $this->dechunk($payload);
        }
        return array('status' => $status, 'head' => $head, 'body' => $payload);
    }

    private function dechunk($body)
    {
        $out = '';
        while (true) {
            $pos = strpos($body, "\r\n");
            if ($pos === false) {
                break;
            }
            $len = hexdec(trim(substr($body, 0, $pos)));
            if ($len <= 0) {
                break;
            }
            $out .= substr($body, $pos + 2, $len);
            $body = substr($body, $pos + 2 + $len + 2);
        }
        return $out;
    }
}
