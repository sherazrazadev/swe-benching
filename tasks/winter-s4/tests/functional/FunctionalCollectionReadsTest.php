<?php

use Illuminate\Support\Collection;

/**
 * Collections supplied by the application keep working: iteration, indexing, counting,
 * selecting values and ordering by an attribute name.
 */
class FunctionalCollectionReadsTest extends WinterHiddenCase
{
    public function testCollectionsStillIterateIndexCountAndSelectValues(): void
    {
        $items = new Collection([
            ['visible' => true, 'n' => 'a'],
            ['visible' => false, 'n' => 'b'],
            ['visible' => true, 'n' => 'c'],
        ]);

        $result = $this->renderTemplate(implode("", [
            "{% for i in items %}{{ i.n }}{% endfor %}",
            "|{{ items|length }}",
            "|{{ items[0].n }}",
            "|{{ items.pluck('n')|join(',') }}",
            "|{{ items.where('visible', true)|length }}",
            "|{{ items.sortBy('n').pluck('n')|join(',') }}",
            "|{{ items.groupBy('visible')|length }}",
            "|{{ attribute(items, 'pluck', ['n'])|join(',') }}",
        ]), ['items' => $items]);

        $this->assertNull($result['error'], 'a legitimate collection use failed to render: '
            . ($result['error'] ? $result['error']->getMessage() : ''));
        $this->assertSame('abc|3|a|a,b,c|2|a,b,c|2|a,b,c', trim($result['output']));
    }

    public function testCollectionRendersAsAValue(): void
    {
        $result = $this->renderTemplate('{{ items|raw }}', [
            'items' => new Collection(['a', 'b']),
        ]);

        $this->assertNull($result['error'], 'a collection value failed to render');
        $this->assertStringContainsString('"a"', $result['output']);
        $this->assertStringContainsString('"b"', $result['output']);
    }
}
