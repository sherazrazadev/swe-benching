<?php

namespace CweBench\Functional;

use CweBench\Media\MediaHarness;
use Kunstmaan\MediaBundle\Entity\Media;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Filesystem\Filesystem as SymfonyFilesystem;

/**
 * Ordinary media must keep the stored names the product produces today.
 */
final class MediaUploadFunctionalTest extends TestCase
{
    private string $root;
    private MediaHarness $harness;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/cwe-upload-fn-' . bin2hex(random_bytes(6));
        $this->harness = new MediaHarness($this->root);
    }

    protected function tearDown(): void
    {
        (new SymfonyFilesystem())->remove($this->root);
    }

    /**
     * @dataProvider legitimateNames
     */
    public function testLegitimateUploadKeepsItsName(string $clientName, string $expectedBasename): void
    {
        $handler = $this->harness->fileHandler();
        $media = $this->harness->upload($handler, $clientName, "GIF89a" . str_repeat('x', 32));

        $this->assertSame($expectedBasename, basename($handler->getOriginalFile($media)->getKey()));
    }

    public function legitimateNames(): array
    {
        return [
            'uppercase image extension' => ['holiday.JPG', 'holiday.jpg'],
            'spaces in the name' => ['My Holiday Picture.jpeg', 'my-holiday-picture.jpeg'],
            'double extension' => ['evil.php.jpg', 'evil-php.jpg'],
            'document' => ['report.pdf', 'report.pdf'],
            'archive' => ['backup.zip', 'backup.zip'],
            'video' => ['movie.MP4', 'movie.mp4'],
        ];
    }

    public function testDoubleExtensionIsKeptAsPartOfTheName(): void
    {
        $handler = $this->harness->fileHandler();

        $media = new Media();
        $media->setUuid('abc123');
        $media->setOriginalFilename('evil.php.jpg');

        $key = $handler->getOriginalFile($media)->getKey();

        $this->assertSame('abc123/evil-php.jpg', $key);
    }

    public function testFileWithoutExtensionGetsNoDot(): void
    {
        $handler = $this->harness->fileHandler();

        $media = new Media();
        $media->setUuid('abc123');
        $media->setOriginalFilename('README');

        $key = $handler->getOriginalFile($media)->getKey();

        $this->assertSame('abc123/readme', $key);
    }

    public function testMediaUrlUsesTheStoredName(): void
    {
        $handler = $this->harness->fileHandler();
        $media = $this->harness->upload($handler, 'holiday.JPG', "GIF89a" . str_repeat('x', 32));

        $this->assertSame('/uploads/media/' . $handler->getOriginalFile($media)->getKey(), $media->getUrl());
    }

    public function testImageHandlerStillStoresImages(): void
    {
        $handler = $this->harness->imageHandler();
        $media = $this->harness->upload($handler, 'holiday.JPG', "GIF89a" . str_repeat('x', 32));

        $this->assertSame('holiday.jpg', basename($handler->getOriginalFile($media)->getKey()));
    }

    public function testPdfHandlerStillStoresPdfDocuments(): void
    {
        $handler = $this->harness->pdfHandler();
        $media = $this->harness->upload(
            $handler,
            'report.pdf',
            "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n"
        );

        $this->assertSame('report.pdf', basename($handler->getOriginalFile($media)->getKey()));
    }
}
