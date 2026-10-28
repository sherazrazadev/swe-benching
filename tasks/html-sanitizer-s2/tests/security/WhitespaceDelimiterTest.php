<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests\Security;

require_once __DIR__ . '/../support/SanitizerTestCase.php';

use CweBench\HtmlSanitizerTests\SanitizerTestCase;

/**
 * The element the configuration returns without encoding ends where the browser says it
 * ends. Whitespace between the name of the closing tag and its bracket is still that tag.
 */
class WhitespaceDelimiterTest extends SanitizerTestCase
{
    public static function payloadProvider(): array
    {
        return [
            'style tab' => [
                'style',
                "<style>div::after{content:'<'}</style\t><img src=x onerror=alert(1)>",
            ],
            'style space' => [
                'style',
                '<style>x</style ><img src=x onerror=alert(1)>',
            ],
            'style newline' => [
                'style',
                "<style>x</style\n><img src=x onerror=alert(1)>",
            ],
            'script tab' => [
                'script',
                "<script>var a='<'</script\t><img src=x onerror=alert(1)>",
            ],
            'iframe tab' => [
                'iframe',
                "<iframe>fallback</iframe\t><img src=x onerror=alert(1)>",
            ],
        ];
    }

    /**
     * @dataProvider payloadProvider
     */
    public function testWhitespaceBeforeClosingBracketDoesNotEndInertContent(
        string $element,
        string $payload
    ): void {
        $output = $this->sanitizeOutput(
            $this->sanitizer($this->rawTextTag($element)),
            $payload
        );
        $this->assertNoLiveImage($output);
    }
}
