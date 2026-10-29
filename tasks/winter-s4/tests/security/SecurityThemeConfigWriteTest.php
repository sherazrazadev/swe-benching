<?php

/**
 * The reported impact: a template writes the theme's configuration file.
 */
class SecurityThemeConfigWriteTest extends WinterHiddenCase
{
    public function testThemeConfigurationCannotBeChangedByATemplate(): void
    {
        $this->writePage('index', "{{ this.theme.writeConfig({ name: 'compromised' }) }}");

        $before = file_get_contents($this->themeDir() . '/theme.yaml');
        $result = $this->renderTheme('/');
        clearstatcache();
        $after = file_get_contents($this->themeDir() . '/theme.yaml');

        $this->assertSame($before, $after, 'template content changed the theme configuration file');
        $this->assertNotNull($result['error'], 'the render that would change the file was not refused with an error');
    }
}
