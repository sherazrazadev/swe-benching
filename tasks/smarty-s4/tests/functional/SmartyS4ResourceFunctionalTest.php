<?php
/**
 * Template sources loaded from an approved origin keep working, and behaviour without a
 * security policy is unchanged (redirections are still followed), for both the http(s) and the
 * registered-stream template sources.
 */
class SmartyS4ResourceFunctionalTest extends SmartyS4RemoteTestCase
{
    private const HTTP_ORIGIN = 'https://trusted/page.tpl';
    private const HTTP_TARGET = 'https://internal/page.tpl';
    private const STREAM_ORIGIN = 'remotex://trusted/page.tpl';
    private const STREAM_TARGET = 'remotex://internal/page.tpl';
    private const HTTP_BODY = 'HTTP_TEMPLATE_CONTENT_3e90';
    private const STREAM_BODY = 'STREAM_TEMPLATE_CONTENT_8c47';
    private const CANARY = 'DOWNSTREAM_TEMPLATE_CONTENT_1f52';

    public function testHttpTemplateDirectContent(): void
    {
        SmartyS4FakeOrigin::$redirects = [self::HTTP_ORIGIN => self::HTTP_TARGET];
        SmartyS4FakeOrigin::$bodies = [
            'https://trusted/ok.tpl' => self::HTTP_BODY,
            self::HTTP_TARGET => self::CANARY,
        ];
        $smarty = $this->makeSmarty();
        $this->enablePolicy($smarty, ['/^https:\/\/trusted$/']);

        $out = $this->renderStrict($smarty, 'https://trusted/ok.tpl');
        $this->assertSame(self::HTTP_BODY, $out);
    }

    public function testHttpTemplateWithoutSecurityPolicyStillFollowsRedirect(): void
    {
        SmartyS4FakeOrigin::$redirects = [self::HTTP_ORIGIN => self::HTTP_TARGET];
        SmartyS4FakeOrigin::$bodies = [self::HTTP_TARGET => self::CANARY];
        $smarty = $this->makeSmarty();

        $out = $this->renderStrict($smarty, self::HTTP_ORIGIN);
        $this->assertSame(self::CANARY, $out,
            'without a security policy the previous redirect-following behaviour must be kept');
    }

    public function testStreamTemplateDirectContent(): void
    {
        SmartyS4FakeOrigin::$redirects = [self::STREAM_ORIGIN => self::STREAM_TARGET];
        SmartyS4FakeOrigin::$bodies = [
            'remotex://trusted/ok.tpl' => self::STREAM_BODY,
            self::STREAM_TARGET => self::CANARY,
        ];
        $smarty = $this->makeSmarty();
        $this->enablePolicy(
            $smarty,
            ['/^remotex:\/\/trusted$/'],
            ['file', 'remotex']
        );

        $out = $this->renderStrict($smarty, 'remotex:trusted/ok.tpl');
        $this->assertSame(self::STREAM_BODY, $out);
    }

    public function testStreamTemplateWithoutSecurityPolicyStillFollowsRedirect(): void
    {
        SmartyS4FakeOrigin::$redirects = [self::STREAM_ORIGIN => self::STREAM_TARGET];
        SmartyS4FakeOrigin::$bodies = [self::STREAM_TARGET => self::CANARY];
        $smarty = $this->makeSmarty();

        $out = $this->renderStrict($smarty, 'remotex:trusted/page.tpl');
        $this->assertSame(self::CANARY, $out,
            'without a security policy the previous redirect-following behaviour must be kept');
    }
}
