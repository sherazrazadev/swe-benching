<?php

namespace CweBench\Security;

use CweBench\Media\MediaHarness;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Filesystem\Filesystem as SymfonyFilesystem;

/**
 * Writing an uploaded file from more than one place in the media library must not leave an
 * executable copy behind.
 */
final class MediaHandlerCopySecurityTest extends TestCase
{
    private string $root;
    private MediaHarness $harness;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/cwe-handler-' . bin2hex(random_bytes(6));
        $this->harness = new MediaHarness($this->root);
    }

    protected function tearDown(): void
    {
        (new SymfonyFilesystem())->remove($this->root);
    }

    public function testImageUploadLeavesNoExecutableFile(): void
    {
        try {
            $this->harness->upload(
                $this->harness->imageHandler(),
                'webshell.php',
                "GIF89a" . str_repeat('x', 32)
            );
        } catch (\Throwable $e) {
            // A refusal with no side effect is acceptable.
        }

        $this->assertSame(
            [],
            $this->harness->executableFiles(),
            'stored files: ' . implode(', ', $this->harness->storedFiles())
        );
    }

    public function testPdfUploadLeavesNoExecutableFile(): void
    {
        try {
            $this->harness->upload(
                $this->harness->pdfHandler(),
                'webshell.php',
                "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n"
            );
        } catch (\Throwable $e) {
            // A refusal with no side effect is acceptable.
        }

        $this->assertSame(
            [],
            $this->harness->executableFiles(),
            'stored files: ' . implode(', ', $this->harness->storedFiles())
        );
    }
}
