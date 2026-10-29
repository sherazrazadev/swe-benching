<?php
/**
 * A template source is loaded through a registered stream from an approved origin; that
 * origin redirects to an unapproved one. The unapproved origin's source must never be loaded,
 * through the rendering API or an include inside another template.
 */
class SmartyS4StreamResourceRedirectTest extends SmartyS4RemoteTestCase
{
    private const ORIGIN = 'remotex://trusted/page.tpl';
    private const TARGET = 'remotex://internal/page.tpl';
    private const CANARY = 'CANARY_STREAM_TEMPLATE_4b2e';

    private function configure(): \Smarty\Smarty
    {
        SmartyS4FakeOrigin::$redirects = [self::ORIGIN => self::TARGET];
        SmartyS4FakeOrigin::$bodies = [self::TARGET => self::CANARY];
        $smarty = $this->makeSmarty();
        $this->enablePolicy(
            $smarty,
            ['/^remotex:\/\/trusted$/'],
            ['file', 'remotex']
        );
        return $smarty;
    }

    public function testStreamTemplateDoesNotFollowRedirectToUnapprovedOrigin(): void
    {
        $smarty = $this->configure();
        $out = $this->renderAllowingRefusal($smarty, 'remotex:trusted/page.tpl');
        $this->assertStringNotContainsString(self::CANARY, $out,
            'source from the unapproved origin reached the rendered result');
        $this->assertOriginNotContacted(self::TARGET, 'the unapproved origin was contacted');
    }

    public function testIncludedStreamTemplateDoesNotFollowRedirectToUnapprovedOrigin(): void
    {
        $smarty = $this->configure();
        $out = $this->renderAllowingRefusal(
            $smarty,
            'string:{include file="remotex:trusted/page.tpl"}'
        );
        $this->assertStringNotContainsString(self::CANARY, $out,
            'source from the unapproved origin reached the rendered result');
        $this->assertOriginNotContacted(self::TARGET, 'the unapproved origin was contacted');
    }
}
