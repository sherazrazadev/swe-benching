<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Functional;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;
use TYPO3\HtmlSanitizer\Behavior\Attr;
use TYPO3\HtmlSanitizer\Behavior\Tag;

/**
 * A complete document is still reduced to its body content; content outside the body is
 * not part of the sanitized result.
 */
class DocumentInputFunctionalTest extends SanitizerTestCase
{
    public function testCompleteDocumentKeepsOnlyBodyContent(): void
    {
        $div = (new Tag('div', Tag::ALLOW_CHILDREN))->addAttrs(new Attr('class'));
        $output = $this->sanitizeOutput(
            $this->sanitizer($div),
            '<!DOCTYPE html><html><head><div class="ok">head</div></head>'
            . '<body><div class="ok">body</div></body></html>'
        );
        $this->assertSame('<div class="ok">body</div>', $output);
    }
}
