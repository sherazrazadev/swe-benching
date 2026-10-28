<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Security;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;

/**
 * A browser in a select insertion mode ignores start tags that would open raw text, so
 * content the sanitizer treated as inert is parsed as ordinary markup in that position.
 */
class SelectContextTest extends SanitizerTestCase
{
    public function testStyleContentInSelectDoesNotEscape(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag('select'), $this->rawTextTag('style')),
            '<select><style></select><img src=x onerror=alert(1)></style></select>'
        );
        $this->assertNoLiveImage($output);
    }

    public function testRawContentInSelectDoesNotEscape(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag('select'), $this->rawTextTag('iframe')),
            '<select><iframe></select><img src=x onerror=alert(1)></iframe></select>'
        );
        $this->assertNoLiveImage($output);
    }
}
