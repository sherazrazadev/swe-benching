<?php
/**
 * The policy approves one origin. That origin answers with a redirection to another origin
 * the policy does not approve. The unapproved origin must never be contacted and its content
 * must never reach the rendered result.
 */
class SmartyS4FetchRedirectTest extends SmartyS4RemoteTestCase
{
    private const ORIGIN = 'https://trusted/notice.txt';
    private const TARGET = 'https://internal/secret.txt';
    private const CANARY = 'CANARY_INTERNAL_CONTENT_7f3a';

    private function configure(): \Smarty\Smarty
    {
        SmartyS4FakeOrigin::$redirects = [self::ORIGIN => self::TARGET];
        SmartyS4FakeOrigin::$bodies = [self::TARGET => self::CANARY];
        $smarty = $this->makeSmarty();
        $this->enablePolicy($smarty, ['/^https:\/\/trusted$/']);
        return $smarty;
    }

    public function testFetchDoesNotFollowRedirectToUnapprovedOrigin(): void
    {
        $smarty = $this->configure();
        $out = $this->renderAllowingRefusal(
            $smarty,
            'string:{fetch file="' . self::ORIGIN . '"}'
        );
        $this->assertStringNotContainsString(self::CANARY, $out,
            'content from the unapproved origin reached the rendered result');
        $this->assertOriginNotContacted(self::TARGET, 'the unapproved origin was contacted');
    }

    public function testFetchAssignDoesNotFollowRedirectToUnapprovedOrigin(): void
    {
        $smarty = $this->configure();
        $out = $this->renderAllowingRefusal(
            $smarty,
            'string:{fetch file="' . self::ORIGIN . '" assign="notice"}{$notice}'
        );
        $this->assertStringNotContainsString(self::CANARY, $out,
            'content from the unapproved origin was assigned into the template');
        $this->assertOriginNotContacted(self::TARGET, 'the unapproved origin was contacted');
    }
}
