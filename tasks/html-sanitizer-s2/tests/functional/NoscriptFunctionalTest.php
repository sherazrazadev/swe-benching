<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Functional;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;
use TYPO3\HtmlSanitizer\Behavior\Attr;
use TYPO3\HtmlSanitizer\Behavior\Tag;

/**
 * Ordinary noscript fallback markup is not raw text and must keep working unchanged.
 */
class NoscriptFunctionalTest extends SanitizerTestCase
{
    public function testOrdinaryNoscriptMarkupIsPreserved(): void
    {
        $paragraph = (new Tag('p', Tag::ALLOW_CHILDREN))->addAttrs(new Attr('id'));
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag('noscript'), $paragraph),
            '<noscript><p id="info">This site requires JavaScript.</p></noscript>'
        );
        $this->assertSame(
            '<noscript><p id="info">This site requires JavaScript.</p></noscript>',
            $output
        );
    }
}
