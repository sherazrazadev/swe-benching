<?php

namespace CweBench\Security;

use CweBench\Media\MediaHarness;
use Kunstmaan\MediaBundle\Entity\Media;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Filesystem\Filesystem as SymfonyFilesystem;

/**
 * The media library must never leave an uploaded file in the public upload directory under an
 * extension a web server can execute, with the product's stock configuration.
 */
final class MediaUploadSecurityTest extends TestCase
{
    private string $root;
    private MediaHarness $harness;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/cwe-upload-' . bin2hex(random_bytes(6));
        $this->harness = new MediaHarness($this->root);
    }

    protected function tearDown(): void
    {
        (new SymfonyFilesystem())->remove($this->root);
    }

    /**
     * @dataProvider executableFileNames
     */
    public function testUploadWithExecutableExtensionIsNeverStoredExecutable(string $clientName): void
    {
        $handler = $this->harness->fileHandler();

        try {
            $this->harness->upload($handler, $clientName, "GIF89a" . str_repeat('x', 32));
        } catch (\Throwable $e) {
            // A fix may refuse the submission outright; that is fine as long as nothing unsafe
            // was written. The side-effect assertion below is what matters.
        }

        $this->assertSame(
            [],
            $this->harness->executableFiles(),
            'stored files: ' . implode(', ', $this->harness->storedFiles())
        );
    }

    public function executableFileNames(): array
    {
        return [
            'mixed case php' => ['webshell.pHp'],
            'upper case php' => ['webshell.PHP'],
            'phtml' => ['webshell.phtml'],
            'php5' => ['webshell.php5'],
            'phar' => ['webshell.phar'],
            'phps' => ['webshell.phps'],
            'pht' => ['webshell.pht'],
            'shtml' => ['webshell.shtml'],
            'cgi' => ['webshell.cgi'],
            'asp' => ['webshell.asp'],
            'jsp' => ['webshell.jsp'],
            'mixed case htaccess' => ['file.HtAccess'],
        ];
    }

    /**
     * A media record whose original name was stored on an earlier upload, and whose file is
     * materialised later, must follow the same rule.
     */
    public function testStoredNameOfExistingMediaStaysSafe(): void
    {
        $handler = $this->harness->fileHandler();

        foreach (['webshell.php', 'webshell.pHp', 'webshell.phtml'] as $originalFilename) {
            $media = new Media();
            $media->setUuid('saved' . md5($originalFilename));
            $media->setOriginalFilename($originalFilename);

            $key = $handler->getOriginalFile($media)->getKey();
            $extension = strtolower(pathinfo($key, PATHINFO_EXTENSION));

            $this->assertNotContains(
                $extension,
                MediaHarness::executableExtensions(),
                'stored key: ' . $key
            );
        }
    }
}
