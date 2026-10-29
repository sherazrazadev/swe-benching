<?php

/**
 * A template overwrites the stored page file through the query object it can reach from the
 * page it is rendering.
 */
class SecurityPageFileBuilderTest extends WinterHiddenCase
{
    public function testPageFileCannotBeOverwrittenThroughAQueryObject(): void
    {
        $this->writePage('index', "{{ this.page.newQuery().update({ markup: 'OVERWRITTEN' }) }}");

        $before = file_get_contents($this->pagePath('index'));
        $result = $this->renderTheme('/');
        clearstatcache();
        $after = file_get_contents($this->pagePath('index'));

        $this->assertSame($before, $after, 'template content overwrote the page file');
        $this->assertNotNull($result['error'], 'the render that would overwrite the file was not refused with an error');
    }
}
