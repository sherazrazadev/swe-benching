<?php

/**
 * The same file through a second theme method: a single-value setter that writes the
 * configuration file.
 */
class SecurityThemeConfigSiblingTest extends WinterHiddenCase
{
    public function testThemeConfigurationCannotBeChangedByATemplateThroughASetter(): void
    {
        $this->writePage('index', "{{ this.theme.saveConfigValue('name', 'compromised') }}");

        $before = file_get_contents($this->themeDir() . '/theme.yaml');
        $this->renderTheme('/');
        clearstatcache();
        $after = file_get_contents($this->themeDir() . '/theme.yaml');

        $this->assertSame($before, $after, 'template content changed the theme configuration file');
    }
}
