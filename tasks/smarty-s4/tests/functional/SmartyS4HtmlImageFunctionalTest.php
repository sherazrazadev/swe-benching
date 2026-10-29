<?php
/**
 * The image-dimension behaviour that must keep working exactly as today: an approved origin
 * that answers directly still yields the correct dimensions, behaviour without a security
 * policy is unchanged (redirections are still followed), and local images still work.
 */
class SmartyS4HtmlImageFunctionalTest extends SmartyS4RemoteTestCase
{
    private const ORIGIN = 'https://trusted/picture.gif';
    private const TARGET = 'https://internal/picture.gif';

    public function testHtmlImageReadsDimensionsFromApprovedOrigin(): void
    {
        SmartyS4FakeOrigin::$redirects = [self::ORIGIN => self::TARGET];
        SmartyS4FakeOrigin::$bodies = [
            'https://trusted/plain.gif' => self::gif(3, 2),
            self::TARGET => self::gif(5, 7),
        ];
        $smarty = $this->makeSmarty();
        $this->enablePolicy($smarty, ['/^https:\/\/trusted$/']);

        $out = $this->renderStrict(
            $smarty,
            'string:{html_image file="https://trusted/plain.gif"}'
        );
        $this->assertStringContainsString('width="3"', $out);
        $this->assertStringContainsString('height="2"', $out);
        $this->assertOriginContacted('https://trusted/plain.gif');
    }

    public function testHtmlImageWithoutSecurityPolicyStillFollowsRedirect(): void
    {
        SmartyS4FakeOrigin::$redirects = [self::ORIGIN => self::TARGET];
        SmartyS4FakeOrigin::$bodies = [self::TARGET => self::gif(5, 7)];
        $smarty = $this->makeSmarty();

        $out = $this->renderStrict($smarty, 'string:{html_image file="' . self::ORIGIN . '"}');
        $this->assertStringContainsString('width="5"', $out);
        $this->assertStringContainsString('height="7"', $out);
        $this->assertOriginContacted(self::TARGET);
    }

    public function testHtmlImageReadsLocalImage(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'smarty-s4-img-');
        file_put_contents($path, self::gif(4, 6));
        $smarty = $this->makeSmarty();
        try {
            $out = $this->renderStrict($smarty, 'string:{html_image file="' . $path . '"}');
            $this->assertStringContainsString('width="4"', $out);
            $this->assertStringContainsString('height="6"', $out);
        } finally {
            @unlink($path);
        }
    }
}
