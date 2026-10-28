<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Security;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;

/**
 * Inside svg or math content a browser does not apply raw-text tokenization, so bytes the
 * sanitizer treated as inert text are parsed as markup there.
 */
class ForeignContentTest extends SanitizerTestCase
{
    public static function payloadProvider(): array
    {
        return [
            'svg closing before content' => [
                'svg',
                '<svg><style></svg><img src=x onerror=alert(1)></style></svg>',
            ],
            'svg content only' => [
                'svg',
                '<svg><style><img src=x onerror=alert(1)></style></svg>',
            ],
            'math content only' => [
                'math',
                '<math><style><img src=x onerror=alert(1)></style></math>',
            ],
        ];
    }

    /**
     * @dataProvider payloadProvider
     */
    public function testRawTextElementInForeignContentDoesNotEscape(
        string $container,
        string $payload
    ): void {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->tag($container), $this->rawTextTag('style')),
            $payload
        );
        $this->assertNoLiveImage($output);
    }
}
