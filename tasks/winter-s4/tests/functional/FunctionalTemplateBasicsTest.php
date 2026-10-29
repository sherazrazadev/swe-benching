<?php

/**
 * Ordinary template features keep working: settings values, conditions, loops, filters and
 * partials.
 */
class FunctionalTemplateBasicsTest extends WinterHiddenCase
{
    public function testSettingsConditionsLoopsAndFiltersStillRender(): void
    {
        $this->writePartial('greeting', '<span>{{ this.page.title }}</span>');
        $this->writePage('index', implode("\n", [
            "<h1>{{ this.page.title }}</h1>",
            "{% if this.page.title == 'Welcome' %}CONDITION-OK{% endif %}",
            "{% for i in [1, 2, 3] %}{{ i }}{% endfor %}",
            "{{ 'abc'|upper }}",
            "{% partial 'greeting' %}",
        ]), "url = \"/\"\ntitle = \"Welcome\"");

        $result = $this->renderTheme('/');

        $this->assertNull($result['error'], 'a legitimate template failed to render');
        $this->assertStringContainsString('<h1>Welcome</h1>', $result['output']);
        $this->assertStringContainsString('CONDITION-OK', $result['output']);
        $this->assertStringContainsString('123', $result['output']);
        $this->assertStringContainsString('ABC', $result['output']);
        $this->assertStringContainsString('<span>Welcome</span>', $result['output']);
    }
}
