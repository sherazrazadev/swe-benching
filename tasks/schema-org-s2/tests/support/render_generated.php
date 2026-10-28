<?php
/**
 * Loads the classes that were just generated into a separate process and renders
 * one case with a supplied value.
 *
 * Usage: php render_generated.php <generated-src> <case> <value>
 */

$src = $argv[1] ?? '';
$case = $argv[2] ?? '';
$value = $argv[3] ?? '';

if ($src === '' || $case === '') {
    fwrite(STDERR, "usage: php render_generated.php <generated-src> <case> <value>\n");
    exit(2);
}

spl_autoload_register(static function (string $class) use ($src): void {
    $prefix = 'Spatie\\SchemaOrg\\';

    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $file = $src.'/'.str_replace('\\', '/', substr($class, strlen($prefix))).'.php';

    if (is_file($file)) {
        require $file;
    }
});

class GeneratedProbeType extends \Spatie\SchemaOrg\BaseType
{
}

switch ($case) {
    case 'body':
        $type = new GeneratedProbeType();
        $type->setProperty('name', $value);
        echo $type->toScript();
        break;

    case 'graph':
        $type = new GeneratedProbeType();
        $type->setProperty('name', $value);
        $graph = new \Spatie\SchemaOrg\Graph();
        $graph->add($type);
        echo $graph->toScript();
        break;

    case 'multi-typed':
        $type = new GeneratedProbeType();
        $type->setProperty('name', $value);
        $entity = new \Spatie\SchemaOrg\MultiTypedEntity();
        $entity->add($type);
        echo $entity->toScript();
        break;

    case 'reference':
        $type = new GeneratedProbeType();
        $type->setProperty('identifier', $value);
        echo $type->referenced()->toScript();
        break;

    case 'option-type':
        $type = new GeneratedProbeType();
        $type->setProperty('name', 'ordinary');
        $type->setNonce($value);
        echo $type->toScript();
        break;

    case 'option-graph':
        $type = new GeneratedProbeType();
        $type->setProperty('name', 'ordinary');
        $graph = new \Spatie\SchemaOrg\Graph();
        $graph->add($type);
        $graph->setNonce($value);
        echo $graph->toScript();
        break;

    case 'option-multi-typed':
        $type = new GeneratedProbeType();
        $type->setProperty('name', 'ordinary');
        $entity = new \Spatie\SchemaOrg\MultiTypedEntity();
        $entity->add($type);
        $entity->setNonce($value);
        echo $entity->toScript();
        break;

    default:
        fwrite(STDERR, "unknown case: {$case}\n");
        exit(2);
}
