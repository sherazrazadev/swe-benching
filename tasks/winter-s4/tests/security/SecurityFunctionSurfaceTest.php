<?php

/**
 * The expression language's function surface must not hand out host files or host values.
 */

enum WinterHiddenEnum: string
{
    case Secret = 'enum-secret';
}

class SecurityFunctionSurfaceTest extends WinterHiddenCase
{
    public function testHostConstantIsNotExposedToATemplate(): void
    {
        $result = $this->renderTemplate("{{ constant('PHP_VERSION') }}");

        $this->assertNotNull($result['error'], 'the host constant read was not refused with an error');
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

    public function testStoredTemplateSourceIsNotExposedWithoutAGetter(): void
    {
        /*
         * The stored template is asked for by the name the loader knows it under, written into
         * the template itself: no getter is used, so denying a getter does not silence the read.
         */
        $name = realpath($this->themeDir() . '/pages') . '/index.htm';
        $this->writePage(
            'index',
            "LEAKCHK-{{ source('" . $name . "') }}",
            'url = "/"'
        );

        $result = $this->renderTheme('/');

        $this->assertStringNotContainsString(
            'LEAKCHK-LEAKCHK-',
            $result['output'],
            'template content read a stored template file'
        );
    }

    public function testEnumCasesAreNotExposedToATemplate(): void
    {
        $result = $this->renderTemplate("{{ enum_cases('WinterHiddenEnum')[0].value }}");

        $this->assertStringNotContainsString(
            'enum-secret',
            $result['output'],
            'template content read host enum cases'
        );
    }
}
