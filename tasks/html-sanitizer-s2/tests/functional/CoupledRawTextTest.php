<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Functional;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;
use TYPO3\HtmlSanitizer\Behavior;
use TYPO3\HtmlSanitizer\Behavior\Attr;
use TYPO3\HtmlSanitizer\Behavior\Tag;
use TYPO3\HtmlSanitizer\Sanitizer;
use TYPO3\HtmlSanitizer\Visitor\CommonVisitor;

/**
 * Content the application explicitly declared as trusted raw text must still come out
 * without encoding; this is the feature the protection must not remove.
 */
class CoupledRawTextTest extends SanitizerTestCase
{
    public function testJsonLdScriptContentIsKeptUnencoded(): void
    {
        $behavior = (new Behavior())
            ->withFlags(Behavior::ENCODE_INVALID_TAG | Behavior::REMOVE_UNEXPECTED_CHILDREN)
            ->withName('json-ld')
            ->withTags(
                (new Tag(
                    'script',
                    Tag::PURGE_WITHOUT_ATTRS | Tag::PURGE_WITHOUT_CHILDREN
                        | Tag::ALLOW_CHILDREN | Tag::ALLOW_INSECURE_RAW_TEXT
                ))->addAttrs(
                    new Attr('id'),
                    (new Attr('type', Attr::MANDATORY))
                        ->addValues(new Behavior\DatasetAttrValue('application/ld+json'))
                )
            );
        $sanitizer = new Sanitizer($behavior, new CommonVisitor($behavior));
        $payload = '10:<script type="application/ld+json">'
            . '{{"@type":"Answer","text":"Usually the answer is <b>42</b>."}}'
            . '</script>';
        $expected = '10:<script type="application/ld+json">'
            . '{{"@type":"Answer","text":"Usually the answer is <b>42</b>."}}'
            . '</script>';

        $this->assertSame($expected, $this->sanitizeOutput($sanitizer, $payload));
    }

    public function testStyleRawContentIsKeptUnencoded(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->rawTextTag('style')),
            "<style>div::after{content:'<'}</style>"
        );
        $this->assertSame("<style>div::after{content:'<'}</style>", $output);
    }

    public function testIframeRawContentIsKeptUnencoded(): void
    {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->rawTextTag('iframe')),
            '<iframe>fallback a < b</iframe>'
        );
        $this->assertSame('<iframe>fallback a < b</iframe>', $output);
    }
}
