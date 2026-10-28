<?php
/**
 * Renders the package into a throw-away directory using the project's own writer,
 * exactly as its build command does, but rooted outside the checked-out tree.
 *
 * Usage: php generate.php <project-root> <destination>
 */

$root = $argv[1] ?? '';
$destination = $argv[2] ?? '';

if ($root === '' || $destination === '') {
    fwrite(STDERR, "usage: php generate.php <project-root> <destination>\n");
    exit(2);
}

require $root.'/vendor/autoload.php';

use Spatie\SchemaOrg\Generator\TypeCollection;
use Spatie\SchemaOrg\Generator\Writer\Filesystem;

$source = $root.'/generator/templates/static';
$target = $destination.'/generator/templates/static';

$copy = function (string $from, string $to) use (&$copy): void {
    if (is_dir($from)) {
        @mkdir($to, 0777, true);
        foreach (array_diff(scandir($from), ['.', '..']) as $entry) {
            $copy($from.'/'.$entry, $to.'/'.$entry);
        }

        return;
    }

    @mkdir(dirname($to), 0777, true);
    copy($from, $to);
};

$copy($source, $target);
@mkdir($destination.'/src', 0777, true);

$filesystem = new Filesystem($destination);
$filesystem->cloneStaticFiles();
$filesystem->createBuilderClass(new TypeCollection([], [], []));

echo "generated\n";
