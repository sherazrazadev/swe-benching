<?php

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * Paged results keep working: totals, the current page, iteration and counting.
 */
class FunctionalPaginatorReadsTest extends WinterHiddenCase
{
    public function testPagedResultsStillNavigateAndIterate(): void
    {
        $paginator = new LengthAwarePaginator(new Collection(['x', 'y']), 2, 1, 1);

        $result = $this->renderTemplate(implode("", [
            "{{ paginator.total() }}",
            "|{{ paginator.currentPage() }}",
            "|{{ paginator|length }}",
            "|{% for i in paginator %}{{ i }}{% endfor %}",
        ]), ['paginator' => $paginator]);

        $this->assertNull($result['error'], 'a legitimate paged-result use failed to render: '
            . ($result['error'] ? $result['error']->getMessage() : ''));
        $this->assertSame('2|1|2|xy', trim($result['output']));
    }
}
