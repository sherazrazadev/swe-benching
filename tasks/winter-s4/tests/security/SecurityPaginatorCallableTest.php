<?php

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * Paged results supplied to a template carry the same callable-taking method.
 */
class SecurityPaginatorCallableTest extends WinterHiddenCase
{
    public function testPagedResultsDoNotExecuteAStringCallableFromATemplate(): void
    {
        $marker = $this->markerPath();
        $paginator = new LengthAwarePaginator(new Collection([$marker]), 1, 10);

        $result = $this->renderTemplate("{{ paginator.through('touch') }}", ['paginator' => $paginator]);

        $this->assertNoSideEffect($marker, 'template content executed a callable through paged results');
        $this->assertNotNull($result['error'], 'the render that would execute a callable was not refused with an error');
    }
}
