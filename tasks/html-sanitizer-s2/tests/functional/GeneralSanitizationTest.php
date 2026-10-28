<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Functional;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;
use TYPO3\HtmlSanitizer\Behavior\Attr;
use TYPO3\HtmlSanitizer\Behavior\Tag;

/**
 * Declared elements and attributes keep binding; everything else is still removed.
 */
class GeneralSanitizationTest extends SanitizerTestCase
{
    public function testAllowedMarkupIsKeptAndUnexpectedElementIsRemoved(): void
    {
        $div = (new Tag('div', Tag::ALLOW_CHILDREN))->addAttrs(new Attr('class'));
        $link = (new Tag('a', Tag::ALLOW_CHILDREN))->addAttrs(new Attr('href'));
        $output = $this->sanitizeOutput(
            $this->sanitizer($div, $link),
            '<div class="ok"><a href="https://example.org/">x</a>'
            . '<img src=x onerror=alert(1)></div>'
        );
        $this->assertSame(
            '<div class="ok"><a href="https://example.org/">x</a></div>',
            $output
        );
    }

    public function testUnexpectedAttributeIsRemoved(): void
    {
        $link = (new Tag('a', Tag::ALLOW_CHILDREN))->addAttrs(new Attr('href'));
        $output = $this->sanitizeOutput(
            $this->sanitizer($link),
            '<a href="https://example.org/" onclick="alert(1)">x</a>'
        );
        $this->assertSame('<a href="https://example.org/">x</a>', $output);
    }
}
