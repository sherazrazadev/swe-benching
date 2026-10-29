<?php

/**
 * The expression language's function surface must not hand out host files or host values.
 */
class SecurityFunctionSurfaceTest extends WinterHiddenCase
{
    public function testHostConstantIsNotExposedToATemplate(): void
    {
        $result = $this->renderTemplate("{{ constant('PHP_VERSION') }}");

        $this->assertStringNotContainsString(PHP_VERSION, $result['output'], 'template content read a host constant');
        $this->assertNotNull($result['error'], 'the render that would read a host constant was not refused with an error');
    }

    public function testEnumCasesAreNotExposedToATemplate(): void
    {
        $result = $this->renderTemplate("{{ enum_cases('WinterHiddenColor')[1].value }}");

        $this->assertStringNotContainsString(
            WinterHiddenColor::Blue->value,
            $result['output'],
            'template content enumerated a host enum'
        );
        $this->assertNotNull($result['error'], 'the render that would enumerate a host enum was not refused with an error');
    }

    public function testStoredTemplateSourceIsNotExposedToATemplate(): void
    {
        $this->writePage(
            'index',
            "LEAKCHK-{{ source(this.page.getFilePath()) }}",
            'url = "/"'
        );

        $result = $this->renderTheme('/');

        $this->assertStringNotContainsString(
            'LEAKCHK-LEAKCHK-',
            $result['output'],
            'template content read a stored template file'
        );
        $this->assertNotNull($result['error'], 'the render that would read a stored template was not refused with an error');
    }

    public function testTemplateNameSourceIsNotExposedToATemplate(): void
    {
        // The stored template is addressed by its template name, not by a path obtained from
        // the page object, so a fix that only blocks the path getter does not hide its source.
        $view = base_path('modules/cms/views/404.php');
        $this->assertFileExists($view, 'the template fixture is missing');
        $source = (string) file_get_contents($view);
        $marker = 'icon-chain-broken';
        $this->assertStringContainsString($marker, $source, 'the template fixture changed');

        $result = $this->renderTemplate("{{ source('cms::404') }}");

        $this->assertStringNotContainsString($marker, $result['output'], 'template content read a stored template by name');
        $this->assertNotNull($result['error'], 'the render that would read a stored template was not refused with an error');
    }
}
