<?php

use Illuminate\Support\Collection;

/**
 * The template engine's own filters that take arrow functions keep working.
 */
class FunctionalArrowFiltersTest extends WinterHiddenCase
{
    public function testTwigArrowFunctionFiltersStillRender(): void
    {
        $result = $this->renderTemplate(implode("", [
            "{{ items|map(v => v ~ '!')|join(',') }}",
            "|{{ items|filter(v => v != 'b')|join(',') }}",
            "|{{ items|sort|join(',') }}",
        ]), ['items' => new Collection(['b', 'a'])]);

        $this->assertNull($result['error'], 'a legitimate arrow-function filter failed to render: '
            . ($result['error'] ? $result['error']->getMessage() : ''));
        $this->assertSame('b!,a!|a|a,b', trim($result['output']));
    }
}
