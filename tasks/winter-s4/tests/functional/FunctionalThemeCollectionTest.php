<?php

/**
 * A real theme render can still iterate the pages of its own theme and read their properties.
 */
class FunctionalThemeCollectionTest extends WinterHiddenCase
{
    public function testThemePagesStillIterateInATemplate(): void
    {
        $this->writePage('a-first', 'FIRST', '');
        $this->writePage('b-second', 'SECOND', '');
        $this->writePage('index', implode('', [
            '{% for p in this.page.get() %}{{ p.fileName }};{% endfor %}',
            '|{{ this.page.get()|length }}',
        ]), 'url = "/"');

        $result = $this->renderTheme('/');

        $this->assertNull($result['error'], 'a legitimate theme render failed: '
            . ($result['error'] ? $result['error']->getMessage() : ''));
        $this->assertStringContainsString('a-first.htm;', $result['output']);
        $this->assertStringContainsString('b-second.htm;', $result['output']);
        $this->assertStringContainsString('|3', $result['output']);
    }

    public function testThemeConfigurationValueStillReadsInATemplate(): void
    {
        $this->writePage('index', "{{ this.theme.getConfigValue('name') }}", 'url = "/"');

        $result = $this->renderTheme('/');

        $this->assertNull($result['error'], 'a legitimate theme configuration read failed to render: '
            . ($result['error'] ? $result['error']->getMessage() : ''));
        $this->assertStringContainsString($this->themeName, $result['output']);
    }
}
