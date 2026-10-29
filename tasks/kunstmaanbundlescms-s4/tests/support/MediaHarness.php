<?php
namespace CweBench\Media;

use Gaufrette\Adapter\Local;
use Gaufrette\Filesystem;
use Kunstmaan\MediaBundle\DependencyInjection\KunstmaanMediaExtension;
use Kunstmaan\MediaBundle\Entity\Media;
use Kunstmaan\MediaBundle\Helper\File\FileHandler;
use Kunstmaan\MediaBundle\Helper\File\PdfHandler;
use Kunstmaan\MediaBundle\Helper\Image\ImageHandler;
use Kunstmaan\MediaBundle\Helper\Transformer\PreviewTransformerInterface;
use Kunstmaan\UtilitiesBundle\Helper\Slugifier;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Mime\MimeTypes;

class NullTransformer implements PreviewTransformerInterface
{
    public function getPreviewFilename($absolutePath) { return $absolutePath . '.jpg'; }
    public function apply($absolutePath) { return $absolutePath; }
}

final class MediaHarness
{
    public string $root;
    public Filesystem $fs;
    private MimeTypes $mime;

    public function __construct(string $root)
    {
        $this->root = $root;
        if (!is_dir($root)) { mkdir($root, 0777, true); }
        $this->fs = new Filesystem(new Local($root, true));
        $this->mime = new MimeTypes();
    }

    /** The effective stock extension list produced by the bundle's configuration layer. */
    public static function defaultBlacklist(): array
    {
        $container = new ContainerBuilder();
        (new KunstmaanMediaExtension())->load([], $container);
        if (!$container->hasParameter('kunstmaan_media.blacklisted_extensions')) {
            return [];
        }

        return $container->getParameter('kunstmaan_media.blacklisted_extensions') ?? [];
    }

    public function fileHandler(?array $blacklist = null): FileHandler
    {
        $h = new FileHandler(0, $this->mime);
        $this->wire($h, $blacklist ?? self::defaultBlacklist());
        return $h;
    }

    public function imageHandler(?array $blacklist = null): ImageHandler
    {
        $h = new ImageHandler(1, $this->mime);
        $this->wire($h, $blacklist ?? self::defaultBlacklist());
        return $h;
    }

    public function pdfHandler(?array $blacklist = null): PdfHandler
    {
        $h = new PdfHandler(1, $this->mime);
        $this->wire($h, $blacklist ?? self::defaultBlacklist());
        $h->setWebPath($this->root);
        $h->setPdfTransformer(new NullTransformer());
        return $h;
    }

    private function wire(FileHandler $h, array $blacklist): void
    {
        $h->setSlugifier(new Slugifier());
        $h->setMediaPath('/uploads/media/');
        $h->setBlacklistedExtensions($blacklist);
        $h->setFileSystem($this->fs);
    }

    public function upload(FileHandler $handler, string $clientName, string $content, ?string $mime = null): Media
    {
        $tmp = tempnam(sys_get_temp_dir(), 'cweup');
        file_put_contents($tmp, $content);
        $file = new UploadedFile($tmp, $clientName, $mime, null, true);
        $media = $handler->createNew($file);
        $handler->prepareMedia($media);
        $handler->saveMedia($media);
        return $media;
    }

    /** @return string[] relative paths of every regular file under the upload root */
    public function storedFiles(): array
    {
        $out = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->root, \FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            if ($f->isFile()) {
                $out[] = substr($f->getPathname(), strlen($this->root) + 1);
            }
        }
        sort($out);
        return $out;
    }

    /** Extensions a web server may execute. Kept in the test, never read from product code. */
    public static function executableExtensions(): array
    {
        return [
            'php','php3','php4','php5','php6','php7','php8','phps','phpt','pht','phtm','phtml',
            'phar','inc','htaccess','htpasswd','htgroup','shtml','shtm','cgi','pl','py','rb','sh',
            'asp','aspx','ashx','asmx','ascx','jsp','jspx','cfm','cfml',
        ];
    }

    /** @return string[] */
    public function executableFiles(): array
    {
        $bad = self::executableExtensions();
        return array_values(array_filter($this->storedFiles(), function ($p) use ($bad) {
            $ext = strtolower(pathinfo($p, PATHINFO_EXTENSION));
            return in_array($ext, $bad, true);
        }));
    }
}
