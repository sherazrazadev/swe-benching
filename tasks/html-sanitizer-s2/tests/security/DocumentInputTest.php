<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Security;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;

/**
 * The same content delimitation applies when the input is a complete document rather than
 * a fragment; the sanitized output must be safe however the input is shaped.
 */
class DocumentInputTest extends SanitizerTestCase
{
    public function testWhitespaceDelimiterInCompleteDocumentDoesNotEscape(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->rawTextTag('style')),
            "<!DOCTYPE html><html><body><style>X</style\t>"
            . '<img src=x onerror=alert(1)></body></html>'
        );
        $this->assertNoLiveImage($output);
    }

    public function testRawTextNestedInNoscriptInCompleteDocumentDoesNotEscape(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag('noscript'), $this->rawTextTag('style')),
            '<!DOCTYPE html><html><body>'
            . '<noscript><style></noscript><img src=x onerror=alert(1)></style></noscript>'
            . '</body></html>'
        );
        $this->assertNoLiveImage($output);
    }
}
