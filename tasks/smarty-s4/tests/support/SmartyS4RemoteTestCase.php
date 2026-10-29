<?php
/**
 * Shared fixture for the hidden suites. Builds a Smarty instance against a scratch compile
 * directory, configures the origin allow-list, and cleans up in the test itself (never with
 * product code, so a hardened helper cannot crash the bookkeeping).
 */
abstract class SmartyS4RemoteTestCase extends \PHPUnit\Framework\TestCase
{
    /** @var string[] scratch directories created for this test */
    private $tempDirs = [];

    protected function setUp(): void
    {
        parent::setUp();
        SmartyS4FakeOrigin::reset();
    }

    protected function tearDown(): void
    {
        foreach ($this->tempDirs as $dir) {
            self::removeDir($dir);
        }
        $this->tempDirs = [];
        SmartyS4FakeOrigin::reset();
        parent::tearDown();
    }

    protected function makeSmarty(): \Smarty\Smarty
    {
        $dir = sys_get_temp_dir() . '/smarty-s4-' . bin2hex(random_bytes(8));
        if (!mkdir($dir . '/compile', 0777, true) && !is_dir($dir . '/compile')) {
            throw new \RuntimeException('could not create scratch directory');
        }
        if (!mkdir($dir . '/cache', 0777, true) && !is_dir($dir . '/cache')) {
            throw new \RuntimeException('could not create scratch directory');
        }
        $smarty = new \Smarty\Smarty();
        $smarty->setCompileDir($dir . '/compile');
        $smarty->setCacheDir($dir . '/cache');
        $smarty->setTemplateDir($dir);
        // Keep the engine's own notices (an unreadable/redirect response is not an image, etc.)
        // from being turned into test errors; a refusal may produce no result.
        $smarty->error_reporting = E_ALL & ~E_NOTICE & ~E_USER_NOTICE & ~E_WARNING & ~E_USER_WARNING;
        $this->tempDirs[] = $dir;
        return $smarty;
    }

    protected function enablePolicy(\Smarty\Smarty $smarty, array $trustedOriginPatterns, array $streams = ['file']): void
    {
        $smarty->enableSecurity();
        $smarty->security_policy->trusted_uri = $trustedOriginPatterns;
        $smarty->security_policy->streams = $streams;
    }

    /**
     * Render a template, treating an error as a refusal (the property allows the engine to
     * report an error or produce no result). The security tests assert the side effect
     * separately, so this cannot hide a successful attack.
     */
    protected function renderAllowingRefusal(\Smarty\Smarty $smarty, string $template): string
    {
        try {
            $result = $smarty->fetch($template);
        } catch (\Throwable $e) {
            return '';
        }
        return is_string($result) ? $result : '';
    }

    /** Render a template that is expected to succeed; errors propagate and fail the test. */
    protected function renderStrict(\Smarty\Smarty $smarty, string $template): string
    {
        $result = $smarty->fetch($template);
        $this->assertIsString($result);
        return $result;
    }

    protected function assertOriginNotContacted(string $url, string $message = ''): void
    {
        $this->assertFalse(
            SmartyS4FakeOrigin::wasOpened($url),
            $message !== '' ? $message : "the unapproved origin {$url} was contacted"
        );
    }

    protected function assertOriginContacted(string $url, string $message = ''): void
    {
        $this->assertTrue(
            SmartyS4FakeOrigin::wasOpened($url),
            $message !== '' ? $message : "the expected origin {$url} was not contacted"
        );
    }

    /** A minimal valid GIF with the requested pixel dimensions (header carries them). */
    protected static function gif(int $width, int $height): string
    {
        return "GIF89a" . pack('v', $width) . pack('v', $height)
            . "\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,"
            . "\x00\x00\x00\x00" . pack('v', $width) . pack('v', $height)
            . "\x00\x02\x02D\x01\x00;";
    }

    private static function removeDir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path) && !is_link($path)) {
                self::removeDir($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
