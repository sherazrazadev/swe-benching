<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Functional;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;

/**
 * An element the configuration did not opt into unencoded output keeps being encoded.
 */
class DefaultEncodingTest extends SanitizerTestCase
{
    public function testStyleContentIsEncodedWithoutOptIn(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag('style')),
            '<style><any>value</any></style>'
        );
        $this->assertSame('<style>&lt;any&gt;value&lt;/any&gt;</style>', $output);
    }

    public function testLegacyTextElementContentIsEncodedWithoutOptIn(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag('xmp')),
            '<xmp><any>value</any></xmp>'
        );
        $this->assertSame('<xmp>&lt;any&gt;value&lt;/any&gt;</xmp>', $output);
    }

    public function testNoembedContentIsEncodedWithoutOptIn(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag('noembed')),
            '<noembed><any>value</any></noembed>'
        );
        $this->assertSame('<noembed>&lt;any&gt;value&lt;/any&gt;</noembed>', $output);
    }
}
