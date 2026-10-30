<?php

/**
 * A callable may also arrive as an array. Two spellings reach the same collection method:
 * a direct method call and the built-in attribute() helper.
 */
class SecurityCollectionArrayCallableTest extends WinterHiddenCase
{
    public function testCollectionMethodDoesNotExecuteAnArrayCallableFromATemplate(): void
    {
        $victim = $this->victimFile();
        $this->writePage('a-payload', $victim, '');
        $this->writePage(
            'b-index',
            "{{ this.page.get().pluck('markup').each(['Illuminate\\\\Support\\\\Facades\\\\File', 'delete']) }}",
            'url = "/"'
        );

        $result = $this->renderTheme('/');

        $this->assertNotNull($result['error'], 'the array callable was not refused with an error');
        clearstatcache();
        $this->assertFileExists($victim, 'template content executed an array callable');
    }

    public function testBuiltInAttributeHelperDoesNotExecuteAnArrayCallable(): void
    {
        $victim = $this->victimFile();
        $this->writePage('a-payload', $victim, '');
        $this->writePage(
            'b-index',
            "{{ attribute(this.page.get().pluck('markup'), 'each', [['Illuminate\\\\Support\\\\Facades\\\\File', 'delete']]) }}",
            'url = "/"'
        );

        $result = $this->renderTheme('/');

        $this->assertNotNull($result['error'], 'the array callable was not refused with an error');
        clearstatcache();
        $this->assertFileExists($victim, 'template content executed an array callable through the attribute helper');
    }
}
