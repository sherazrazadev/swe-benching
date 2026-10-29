<?php

namespace CweBench\Functional;

use CweBench\Media\MediaHarness;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectRepository;
use Kunstmaan\MediaBundle\Command\RenameSoftDeletedCommand;
use Kunstmaan\MediaBundle\Entity\Media;
use Kunstmaan\MediaBundle\Helper\File\FileHandler;
use Kunstmaan\MediaBundle\Helper\MediaManager;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem as SymfonyFilesystem;

/**
 * Renaming a soft-deleted media back to its original name keeps working for ordinary files.
 */
final class MediaRenameCommandFunctionalTest extends TestCase
{
    private string $root;
    private MediaHarness $harness;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/cwe-rename-fn-' . bin2hex(random_bytes(6));
        $this->harness = new MediaHarness($this->root);
    }

    protected function tearDown(): void
    {
        (new SymfonyFilesystem())->remove($this->root);
    }

    public function testRenameMovesTheFileBackToItsOriginalName(): void
    {
        $handler = $this->harness->fileHandler();
        $uuid = 'media' . bin2hex(random_bytes(4));
        mkdir($this->root . '/' . $uuid, 0777, true);
        file_put_contents($this->root . '/' . $uuid . '/tmpname.jpg', 'image-bytes');

        $media = new Media();
        $media->setUuid($uuid);
        $media->setOriginalFilename('photo.jpg');
        $media->setUrl('/uploads/media/' . $uuid . '/tmpname.jpg');
        $media->setLocation('local');
        $media->setDeleted(true);

        $this->runCommand($media, $handler);

        $this->assertFileExists($this->root . '/' . $uuid . '/photo.jpg');
        $this->assertFileDoesNotExist($this->root . '/' . $uuid . '/tmpname.jpg');
        $this->assertSame('image-bytes', file_get_contents($this->root . '/' . $uuid . '/photo.jpg'));
    }

    private function runCommand(Media $media, FileHandler $handler): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $repository = $this->createMock(ObjectRepository::class);
        $repository->method('findAll')->willReturn([$media]);
        $em->method('getRepository')->willReturn($repository);

        $manager = new MediaManager();
        $manager->addHandler($handler);
        $manager->setDefaultHandler($handler);

        $tester = new CommandTester(new RenameSoftDeletedCommand($em, $manager));
        $tester->execute(['--original' => true]);
    }
}
