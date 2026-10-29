<?php

/**
 * A template supplies a callable to a collection method; the callable must not run and the
 * render must be refused.
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

        $result = $this->renderTheme('/');

        $this->assertNoSideEffect($marker, 'template content executed a callable');
        $this->assertNotNull($result['error'], 'the render that would execute a callable was not refused with an error');
    }
}
