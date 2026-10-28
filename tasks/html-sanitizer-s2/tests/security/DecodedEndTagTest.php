<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Security;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;

/**
 * Content read with character references decoded can hold a closing tag sequence that the
 * browser, reading the same bytes as plain text, treats as the end of the element.
 */
class DecodedEndTagTest extends SanitizerTestCase
{
    public function testDecodedClosingTagDoesNotBecomeMarkup(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->rawTextTag('xmp')),
            '<xmp>&lt;/xmp&gt;&lt;img src=x onerror=alert(1)&gt;</xmp>'
        );
        $this->assertNoLiveImage($output);
    }
}
