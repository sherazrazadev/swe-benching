<?php
/**
 * The content-fetching behaviour that must keep working exactly as today: an approved origin
 * that answers directly is still read (also when the result is assigned), behaviour without a
 * security policy is unchanged (redirections are still followed), and local files still work.
 */
class SmartyS4FetchFunctionalTest extends SmartyS4RemoteTestCase
{
    private const ORIGIN = 'https://trusted/notice.txt';
    private const TARGET = 'https://internal/secret.txt';
    private const APPROVED = 'APPROVED_CONTENT_5d81';
    private const CANARY = 'DOWNSTREAM_CONTENT_2a6f';

    public function testFetchReadsDirectApprovedOrigin(): void
    {
        SmartyS4FakeOrigin::$redirects = [self::ORIGIN => self::TARGET];
        SmartyS4FakeOrigin::$bodies = [
            'https://trusted/direct.txt' => self::APPROVED,
            self::TARGET => self::CANARY,
        ];
        $smarty = $this->makeSmarty();
        $this->enablePolicy($smarty, ['/^https:\/\/trusted$/']);

        $out = $this->renderStrict(
            $smarty,
            'string:{fetch file="https://trusted/direct.txt"}'
        );
        $this->assertSame(self::APPROVED, $out);
    }

    public function testFetchAssignReadsDirectApprovedOrigin(): void
    {
        SmartyS4FakeOrigin::$bodies = ['https://trusted/direct.txt' => self::APPROVED];
        $smarty = $this->makeSmarty();
        $this->enablePolicy($smarty, ['/^https:\/\/trusted$/']);

        $out = $this->renderStrict(
            $smarty,
            'string:{fetch file="https://trusted/direct.txt" assign="notice"}{$notice}'
        );
        $this->assertSame(self::APPROVED, $out);
    }

    public function testFetchWithoutSecurityPolicyStillFollowsRedirect(): void
    {
        SmartyS4FakeOrigin::$redirects = [self::ORIGIN => self::TARGET];
        SmartyS4FakeOrigin::$bodies = [self::TARGET => self::CANARY];
        $smarty = $this->makeSmarty();

        $out = $this->renderStrict($smarty, 'string:{fetch file="' . self::ORIGIN . '"}');
        $this->assertSame(self::CANARY, $out,
            'without a security policy the previous redirect-following behaviour must be kept');
    }

    public function testFetchReadsLocalFile(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'smarty-s4-fetch-');
        file_put_contents($path, self::APPROVED);
        $smarty = $this->makeSmarty();
        try {
            $out = $this->renderStrict($smarty, 'string:{fetch file="' . $path . '"}');
            $this->assertSame(self::APPROVED, $out);
        } finally {
            @unlink($path);
        }
    }
}
