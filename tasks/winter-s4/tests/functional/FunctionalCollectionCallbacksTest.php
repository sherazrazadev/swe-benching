<?php

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * Callbacks written in the template keep working on the values the application supplies.
 */
class FunctionalCollectionCallbacksTest extends WinterHiddenCase
{
    public function testTemplateCallbacksStillWorkOnCollections(): void
    {
        $result = $this->renderTemplate(
            "{{ items.filter(v => v > 1)|join(',') }}|{{ items.map(v => v * 2)|join(',') }}",
            ['items' => new Collection([1, 2, 3])]
        );

        $this->assertNull($result['error'], 'a legitimate template callback failed to render: '
            . ($result['error'] ? $result['error']->getMessage() : ''));
        $this->assertSame('2,3|2,4,6', trim($result['output']));
    }

    public function testTemplateCallbacksStillWorkOnPagedResults(): void
    {
        $paginator = new LengthAwarePaginator(new Collection(['x', 'y']), 2, 10);

        $result = $this->renderTemplate(
            "{% set _ = paginator.through(v => v ~ '!') %}{% for i in paginator %}{{ i }}{% endfor %}",
            ['paginator' => $paginator]
        );

        $this->assertNull($result['error'], 'a legitimate paged-result callback failed to render: '
            . ($result['error'] ? $result['error']->getMessage() : ''));
        $this->assertSame('x!y!', trim($result['output']));
    }
}
