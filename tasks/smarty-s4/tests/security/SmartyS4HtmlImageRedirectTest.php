<?php
/**
 * A tag that reports an image's dimensions reads the image from an approved origin. That
 * origin redirects to an unapproved one; the unapproved origin carries an image of different
 * dimensions. Neither the read nor the dimensions may come from the unapproved origin.
 */
class SmartyS4HtmlImageRedirectTest extends SmartyS4RemoteTestCase
{
    private const ORIGIN = 'https://trusted/picture.gif';
    private const TARGET = 'https://internal/picture.gif';

    private function configure(): \Smarty\Smarty
    {
        SmartyS4FakeOrigin::$redirects = [self::ORIGIN => self::TARGET];
        SmartyS4FakeOrigin::$bodies = [
            self::TARGET => self::gif(5, 7),
            'https://trusted/plain.gif' => self::gif(3, 2),
        ];
        $smarty = $this->makeSmarty();
        $this->enablePolicy($smarty, ['/^https:\/\/trusted$/']);
        return $smarty;
    }

    public function testHtmlImageDoesNotFollowRedirectToUnapprovedOrigin(): void
    {
        $smarty = $this->configure();
        $out = $this->renderAllowingRefusal(
            $smarty,
            'string:{html_image file="' . self::ORIGIN . '"}'
        );
        $this->assertOriginNotContacted(self::TARGET, 'the unapproved origin was contacted');
        $this->assertStringNotContainsString('width="5"', $out,
            'the rendered dimensions came from the unapproved origin');
    }

    public function testHtmlImageWithOneDimensionDoesNotFollowRedirectToUnapprovedOrigin(): void
    {
        $smarty = $this->configure();
        $out = $this->renderAllowingRefusal(
            $smarty,
            'string:{html_image file="' . self::ORIGIN . '" width="10"}'
        );
        $this->assertOriginNotContacted(self::TARGET, 'the unapproved origin was contacted');
        $this->assertStringNotContainsString('height="7"', $out,
            'the rendered dimensions came from the unapproved origin');
    }
}
