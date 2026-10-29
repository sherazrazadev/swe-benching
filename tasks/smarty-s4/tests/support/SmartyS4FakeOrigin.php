<?php
/**
 * Offline stand-in for an HTTP(S) origin used by the hidden suites.
 *
 * It models what PHP's built-in HTTP wrapper does with a redirect response: when the caller
 * passed a stream context that disables redirect following, the origin's own response body is
 * served; otherwise the wrapper reads the redirect target (a different host) and serves that
 * body instead. Every URL actually opened is recorded, so a test can assert that the
 * redirect target was never contacted.
 *
 * Test bookkeeping only: it computes no expected value from product code and holds no
 * product behaviour.
 */
class SmartyS4FakeOrigin
{
    /** @var resource|null set by PHP when a stream context is passed */
    public $context;

    /** @var string[] normalised URLs in the order they were opened */
    public static $opened = [];

    /** @var array<string,string> origin URL key => redirect target URL */
    public static $redirects = [];

    /** @var array<string,string> URL key => response body */
    public static $bodies = [];

    /** @var string the origin's own body for a redirect it does not follow */
    public static $redirectBody = 'REDIRECT_RESPONSE_BODY';

    private $data = '';
    private $pos = 0;

    public static function register(): void
    {
        foreach (['http', 'https', 'remotex'] as $scheme) {
            if (in_array($scheme, stream_get_wrappers(), true)) {
                @stream_wrapper_unregister($scheme);
            }
            stream_wrapper_register($scheme, self::class, STREAM_IS_URL);
        }
    }

    public static function reset(): void
    {
        self::$opened = [];
        self::$redirects = [];
        self::$bodies = [];
        self::$redirectBody = 'REDIRECT_RESPONSE_BODY';
    }

    /** Normalise any URL to scheme://host/path, the key used by the maps above. */
    public static function keyOf(string $url): string
    {
        $u = parse_url($url);
        return strtolower($u['scheme'] ?? '') . '://' . strtolower($u['host'] ?? '') . ($u['path'] ?? '');
    }

    public static function wasOpened(string $url): bool
    {
        return in_array(self::keyOf($url), self::$opened, true);
    }

    private function followsRedirects(): bool
    {
        if (!isset($this->context)) {
            return true;
        }
        $options = stream_context_get_options($this->context);
        if (isset($options['http']['follow_location'])
            && (int)$options['http']['follow_location'] === 0) {
            return false;
        }
        if (isset($options['http']['max_redirects'])
            && (int)$options['http']['max_redirects'] <= 1) {
            return false;
        }
        return true;
    }

    public function stream_open($path, $mode, $options, &$opened_path): bool
    {
        $key = self::keyOf($path);
        self::$opened[] = $key;

        if (isset(self::$redirects[$key])) {
            if ($this->followsRedirects()) {
                $target = self::$redirects[$key];
                $body = @file_get_contents($target);
                $this->data = $body === false ? '' : $body;
            } else {
                $this->data = self::$redirectBody;
            }
            return true;
        }

        $this->data = self::$bodies[$key] ?? '';
        return true;
    }

    public function stream_read($count): string
    {
        $chunk = substr($this->data, $this->pos, $count);
        $this->pos += strlen($chunk);
        return $chunk;
    }

    public function stream_eof(): bool
    {
        return $this->pos >= strlen($this->data);
    }

    public function stream_close(): void
    {
    }

    public function stream_stat(): array
    {
        return self::statFor(strlen($this->data));
    }

    public function url_stat($path, $flags): array
    {
        $key = self::keyOf($path);
        $length = isset(self::$redirects[$key])
            ? strlen(self::$redirectBody)
            : strlen(self::$bodies[$key] ?? '');
        if ($length === 0) {
            $length = 1;
        }
        return self::statFor($length);
    }

    private static function statFor(int $length): array
    {
        $now = time();
        return [
            'dev' => 0, 'ino' => 0, 'mode' => 0100644, 'nlink' => 1, 'uid' => 0, 'gid' => 0,
            'rdev' => 0, 'size' => $length, 'atime' => $now, 'mtime' => $now, 'ctime' => $now,
            'blksize' => 4096, 'blocks' => 1,
        ];
    }
}
