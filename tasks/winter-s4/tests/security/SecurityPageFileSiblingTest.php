<?php

/**
 * The same stored page file through a convenience method on the object itself.
 */
class SecurityPageFileSiblingTest extends WinterHiddenCase
{
    public function testPageFileCannotBeOverwrittenThroughASaveHelper(): void
    {
        $this->writePage('index', "{{ this.page.saveAttributes({ markup: 'OVERWRITTEN' }) }}");

        $before = file_get_contents($this->pagePath('index'));
        $result = $this->renderTheme('/');
        clearstatcache();
        $after = file_get_contents($this->pagePath('index'));

        $this->assertSame($before, $after, 'template content overwrote the page file');
        $this->assertNotNull($result['error'], 'the render that would overwrite the file was not refused with an error');
    }
}
