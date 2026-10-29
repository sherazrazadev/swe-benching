<?php

/**
 * A callable given to a method reached through the model must not run, and the render must be
 * refused.
 */
class SecurityModelForwardCallableTest extends WinterHiddenCase
{
    public function testForwardedModelMethodDoesNotExecuteAStringCallable(): void
    {
        $this->setUpDatabase();
        $item = $this->makeItem('FORWARD-MARKER');

        ob_start();
        try {
            $result = $this->renderTemplate("{{ model.each('var_dump') }}", ['model' => $item]);
            $echoed = (string) ob_get_clean();
        } catch (\Throwable $e) {
            $echoed = (string) ob_get_clean();
            $result = ['output' => '', 'error' => $e];
        }

        $combined = $result['output'] . $echoed;
        $this->assertStringNotContainsString('FORWARD-MARKER', $combined, 'template content executed a callable');
        $this->assertNotNull($result['error'], 'the render that would execute a callable was not refused with an error');
    }
}
