<?php

/**
 * The built-in attribute() helper reaches the same collection method without the dot-call
 * spelling.
 */
class SecurityAttributeFunctionCallableTest extends WinterHiddenCase
{
    public function testAttributeHelperDoesNotExecuteAStringCallable(): void
    {
        $marker = $this->markerPath();
        $this->writePage('a-payload', $marker, '');
        $this->writePage(
            'b-index',
            "{{ attribute(this.page.get().pluck('markup'), 'each', ['touch']) }}",
            'url = "/"'
        );

        $result = $this->renderTheme('/');

        $this->assertNoSideEffect($marker, 'template content executed a callable through the attribute helper');
        $this->assertNotNull($result['error'], 'the render that would execute a callable was not refused with an error');
    }
}
