<?php

/**
 * A template supplies a callable to a collection method; the callable must not run.
 */
class SecurityCollectionStringCallableTest extends WinterHiddenCase
{
    public function testCollectionMethodDoesNotExecuteAStringCallableFromATemplate(): void
    {
        $marker = $this->markerPath();
        $this->writePage('a-payload', $marker, '');
        $this->writePage(
            'b-index',
            "{{ this.page.get().pluck('markup').each('touch') }}",
            'url = "/"'
        );

        $this->renderTheme('/');

        $this->assertNoSideEffect($marker, 'template content executed a callable');
    }
}
