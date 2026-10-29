<?php

namespace CweBench\Security;

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
 * A media file that was accepted safely must stay safe when the product later renames it.
 */
final class MediaRenameCommandSecurityTest extends TestCase
{
    private string $root;
    private MediaHarness $harness;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/cwe-rename-' . bin2hex(random_bytes(6));
        $this->harness = new MediaHarness($this->root);
    }

    protected function tearDown(): void
    {
        (new SymfonyFilesystem())->remove($this->root);
    }

    public function testRenameToOriginalNameStaysSafe(): void
    {
        $handler = $this->harness->fileHandler();

        try {
            $media = $this->harness->upload($handler, 'webshell.php', "GIF89a" . str_repeat('x', 32));
        } catch (\Throwable $e) {
            $media = null;
        }

        if (null === $media) {
            $this->assertSame([], $this->harness->executableFiles());

            return;
        }

        $media->setDeleted(true);
        $media->setLocation('local');

        try {
            $this->runCommand($media, $handler);
        } catch (\Throwable $e) {
            // A refusal with no side effect is acceptable.
        }

        $this->assertSame(
            [],
            $this->harness->executableFiles(),
            'stored files: ' . implode(', ', $this->harness->storedFiles())
        );
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
