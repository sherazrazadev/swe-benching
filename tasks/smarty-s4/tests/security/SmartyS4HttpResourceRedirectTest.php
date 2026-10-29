<?php
/**
 * A template source is loaded from an approved origin; that origin redirects to an unapproved
 * one. The unapproved origin's source must never be loaded, through the rendering API or an
 * include inside another template.
 */
class SmartyS4HttpResourceRedirectTest extends SmartyS4RemoteTestCase
{
    private const ORIGIN = 'https://trusted/page.tpl';
    private const TARGET = 'https://internal/page.tpl';
    private const CANARY = 'CANARY_REMOTE_TEMPLATE_9c1d';

    private function configure(): \Smarty\Smarty
    {
        SmartyS4FakeOrigin::$redirects = [self::ORIGIN => self::TARGET];
        SmartyS4FakeOrigin::$bodies = [self::TARGET => self::CANARY];
        $smarty = $this->makeSmarty();
        $this->enablePolicy($smarty, ['/^https:\/\/trusted$/']);
        return $smarty;
    }

    public function testRemoteTemplateDoesNotFollowRedirectToUnapprovedOrigin(): void
    {
        $smarty = $this->configure();
        $out = $this->renderAllowingRefusal($smarty, self::ORIGIN);
        $this->assertStringNotContainsString(self::CANARY, $out,
            'source from the unapproved origin reached the rendered result');
        $this->assertOriginNotContacted(self::TARGET, 'the unapproved origin was contacted');
    }

    public function testIncludedRemoteTemplateDoesNotFollowRedirectToUnapprovedOrigin(): void
    {
        $smarty = $this->configure();
        $out = $this->renderAllowingRefusal(
            $smarty,
            'string:{include file="' . self::ORIGIN . '"}'
        );
        $this->assertStringNotContainsString(self::CANARY, $out,
            'source from the unapproved origin reached the rendered result');
        $this->assertOriginNotContacted(self::TARGET, 'the unapproved origin was contacted');
    }
}
