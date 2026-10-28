<?php

namespace CweBench\SchemaOrg;

/**
 * Bookkeeping for the checks that exercise the project's own code generator.
 * It renders the package into a throw-away directory and runs the generated
 * classes in a separate PHP process, so the generated code is loaded as a
 * browser-facing library and never replaces the checked-out sources.
 */
final class GeneratorHarness
{
    public static function root(): string
    {
        return dirname(dirname(__DIR__));
    }

    public static function generate(): string
    {
        $destination = sys_get_temp_dir().'/schema-org-s2-generated-'.bin2hex(random_bytes(8));

        if (! mkdir($destination, 0777, true) && ! is_dir($destination)) {
            throw new \RuntimeException('cannot create '.$destination);
        }

        $command = escapeshellarg(PHP_BINARY)
            .' '.escapeshellarg(__DIR__.'/generate.php')
            .' '.escapeshellarg(self::root())
            .' '.escapeshellarg($destination)
            .' 2>&1';

        exec($command, $output, $status);

        if ($status !== 0) {
            self::cleanup($destination);

            throw new \RuntimeException('code generation failed: '.implode("\n", $output));
        }

        return $destination;
    }

    public static function render(string $destination, string $case, string $value): string
    {
        $command = escapeshellarg(PHP_BINARY)
            .' '.escapeshellarg(__DIR__.'/render_generated.php')
            .' '.escapeshellarg($destination.'/src')
            .' '.escapeshellarg($case)
            .' '.escapeshellarg($value);

        $output = shell_exec($command);

        if (! is_string($output) || $output === '') {
            throw new \RuntimeException('the generated renderer produced no output for '.$case);
        }

        return $output;
    }

    public static function cleanup(string $destination): void
    {
        exec('rm -rf '.escapeshellarg($destination));
    }
}
