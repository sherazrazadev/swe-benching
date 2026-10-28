<?php

declare(strict_types=1);

namespace CweBench\HtmlSanitizerTests;

use PHPUnit\Framework\TestCase;
use TYPO3\HtmlSanitizer\Behavior;
use TYPO3\HtmlSanitizer\Behavior\Tag;
use TYPO3\HtmlSanitizer\Sanitizer;
use TYPO3\HtmlSanitizer\Visitor\CommonVisitor;

/**
 * Shared scenario setup. Every scenario configures the sanitizer only through the
 * library's public behavior model and drives it through Sanitizer::sanitize().
 */
abstract class SanitizerTestCase extends TestCase
{
    protected function tag(string $name): Tag
    {
        return new Tag($name, Tag::ALLOW_CHILDREN);
    }

    /**
     * A tag the configuration opts into returning without encoding.
     */
    protected function rawTextTag(string $name): Tag
    {
        return new Tag($name, Tag::ALLOW_CHILDREN | Tag::ALLOW_INSECURE_RAW_TEXT);
    }

    protected function sanitizer(Tag ...$tags): Sanitizer
    {
        $behavior = (new Behavior())
            ->withFlags(Behavior::REMOVE_UNEXPECTED_CHILDREN)
            ->withName('cwe-bench')
            ->withTags(...$tags);
        return new Sanitizer($behavior, new CommonVisitor($behavior));
    }

    /**
     * Sanitization must always yield a string; a thrown exception is a crash, not a refusal.
     */
    protected function sanitizeOutput(Sanitizer $sanitizer, string $html): string
    {
        try {
            $output = $sanitizer->sanitize($html);
        } catch (\Throwable $throwable) {
            $this->fail(
                'sanitize() must return a string, but threw '
                . get_class($throwable) . ': ' . $throwable->getMessage()
            );
        }
        $this->assertTrue(is_string($output), 'sanitize() did not return a string');
        return $output;
    }

    /**
     * The image element is never allowed in these scenarios, so a complete tag opener
     * in the returned string is markup a browser would parse and execute.
     */
    protected function assertNoLiveImage(string $output): void
    {
        $this->assertSame(
            0,
            preg_match('/<\s*img[\s\/>]/i', $output),
            'Attacker markup survived as a live element. Output: ' . $output
        );
    }
}
