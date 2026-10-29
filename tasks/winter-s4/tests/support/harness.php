<?php

use Cms\Classes\Controller;
use Cms\Classes\Theme;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A host enum the application defines. Its cases are host values a template must not be able
 * to enumerate unless the application supplied them.
 */
enum WinterHiddenColor: string
{
    case Red = 'HIDDEN-ENUM-RED';
    case Blue = 'HIDDEN-ENUM-BLUE';
}

/**
 * A database-backed model the application can hand to a template. The suites create the
 * table in an in-memory SQLite database for each case.
 */
class WinterHiddenItem extends \Winter\Storm\Database\Model
{
    protected $table = 'hidden_items';

    public $timestamps = false;

    protected $guarded = [];
}

/**
 * Shared setup for the hidden suites.
 *
 * Each case gets its own temporary theme under a temporary themes root, so no two cases
 * share a template, a URL map entry or a CMS object cache entry. Rendering goes through the
 * same entry points the project's own tests use: a theme rendered by Cms\Classes\Controller,
 * and the CMS Twig environment the application exposes to templates.
 */
abstract class WinterHiddenCase extends \System\Tests\Bootstrap\TestCase
{
    /** @var string */
    protected $themesRoot = '';

    /** @var string */
    protected $themeName = '';

    /** @var mixed */
    protected $previousThemesPath = null;

    protected function setUp(): void
    {
        parent::setUp();

        \Config::set('cms.enableSafeMode', true);

        $this->previousThemesPath = app('path.themes');
        $this->themesRoot = sys_get_temp_dir() . '/winter-hidden-' . bin2hex(random_bytes(8));
        $this->themeName = 'theme' . bin2hex(random_bytes(4));

        mkdir($this->themeDir() . '/pages', 0777, true);
        mkdir($this->themeDir() . '/layouts', 0777, true);
        mkdir($this->themeDir() . '/partials', 0777, true);
        file_put_contents($this->themeDir() . '/theme.yaml', "name: " . $this->themeName . "\n");

        \App::setThemesPath($this->themesRoot);
    }

    protected function tearDown(): void
    {
        \App::setThemesPath($this->previousThemesPath ?: base_path('themes'));
        $this->removeDirectory($this->themesRoot);
        parent::tearDown();
    }

    //
    // Theme fixtures
    //

    protected function themeDir(): string
    {
        return $this->themesRoot . '/' . $this->themeName;
    }

    protected function pagePath(string $name): string
    {
        return $this->themeDir() . '/pages/' . $name . '.htm';
    }

    /**
     * Writes a page file. $settings is the INI section (always contains the url), $markup the
     * template body. An empty $settings writes a page with no settings section.
     */
    protected function writePage(string $name, string $markup, ?string $settings = null): void
    {
        if ($settings === null) {
            $settings = 'url = "/"';
        }

        $content = $settings === '' ? "==\n" . $markup : $settings . "\n==\n" . $markup;
        file_put_contents($this->pagePath($name), $content);
        clearstatcache();
    }

    protected function writePartial(string $name, string $markup): void
    {
        file_put_contents($this->themeDir() . '/partials/' . $name . '.htm', $markup);
        clearstatcache();
    }

    protected function writeLayout(string $name, string $markup): void
    {
        file_put_contents($this->themeDir() . '/layouts/' . $name . '.htm', $markup);
        clearstatcache();
    }

    //
    // Entry points
    //

    /**
     * Renders a URL through the CMS front end. Returns ['output' => string, 'error' => Throwable|null];
     * every error is captured, so a case never depends on one particular failure form.
     */
    protected function renderTheme(string $url = '/'): array
    {
        try {
            $theme = Theme::load($this->themeName);
            $controller = new Controller($theme);
            $result = $controller->run($url);
            $output = is_object($result) && method_exists($result, 'getContent')
                ? $result->getContent()
                : (string) $result;

            return ['output' => (string) $output, 'error' => null];
        } catch (\Throwable $e) {
            return ['output' => '', 'error' => $e];
        }
    }

    /**
     * Renders a template through the CMS Twig environment, with the same controller globals
     * and application-supplied values a component would provide.
     */
    protected function renderTemplate(string $source, array $vars = []): array
    {
        try {
            $controller = new Controller();
            $twig = $controller->getTwig();
            $template = $twig->createTemplate($source, 'hidden.case');
            $output = $twig->render($template, [
                'this' => array_merge($controller->getControllerGlobalVars(), ['theme' => new Theme()]),
            ] + $vars);

            return ['output' => (string) $output, 'error' => null];
        } catch (\Throwable $e) {
            return ['output' => '', 'error' => $e];
        }
    }

    //
    // Database fixtures
    //

    protected function setUpDatabase(): void
    {
        \Config::set('database.default', 'sqlite');
        \Config::set('database.connections.sqlite.database', ':memory:');
        app('db')->purge('sqlite');

        Schema::create('hidden_items', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name')->nullable();
            $table->integer('count')->default(0);
        });
    }

    protected function makeItem(string $name = 'original'): WinterHiddenItem
    {
        $item = WinterHiddenItem::create(['name' => $name, 'count' => 1]);

        return WinterHiddenItem::find($item->id);
    }

    //
    // Markers and cleanup
    //

    /** A path no legitimate render would ever write. */
    protected function markerPath(): string
    {
        return sys_get_temp_dir() . '/winter-marker-' . bin2hex(random_bytes(8));
    }

    /** A throwaway file the suites expect an attack to be able to delete. */
    protected function victimFile(): string
    {
        $path = $this->markerPath();
        file_put_contents($path, 'victim');

        return $path;
    }

    protected function assertNoSideEffect(string $path, string $message): void
    {
        clearstatcache();
        $this->assertFileDoesNotExist($path, $message);
    }

    protected static function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $dir . '/' . $entry;
            is_dir($path) ? self::removeDirectory($path) : @unlink($path);
        }
        @rmdir($dir);
    }
}
