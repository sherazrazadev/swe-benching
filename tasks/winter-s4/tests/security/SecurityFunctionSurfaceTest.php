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
    }
}
