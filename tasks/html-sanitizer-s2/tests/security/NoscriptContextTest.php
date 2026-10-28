<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Security;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;

/**
 * With scripting enabled a browser reads the content of a noscript element as raw text,
 * so a closing tag that reaches the output unchanged re-enters markup parsing.
 */
class NoscriptContextTest extends SanitizerTestCase
{
    public function testRawTextElementNestedInNoscriptDoesNotEscape(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag('noscript'), $this->rawTextTag('style')),
            '<noscript><style></noscript><img src=x onerror=alert(1)></style></noscript>'
        );
        $this->assertNoLiveImage($output);
    }

    public function testIframeNestedInNoscriptDoesNotEscape(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag('noscript'), $this->rawTextTag('iframe')),
            '<noscript><iframe></noscript><img src=x onerror=alert(1)></iframe></noscript>'
        );
        $this->assertNoLiveImage($output);
    }
}
