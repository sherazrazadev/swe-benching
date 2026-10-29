<?php

/**
 * The session methods templates are allowed to use keep working.
 */
class FunctionalSessionTest extends WinterHiddenCase
{
    public function testAllowedSessionMethodsStillWork(): void
    {
        $result = $this->renderTemplate(implode('', [
            "{{ this.session.put('k', 'v') }}",
            "{{ this.session.get('k') }}",
            "{% if this.session.has('k') %}has{% endif %}",
            "{{ this.session.forget('k') }}",
            "{% if not this.session.has('k') %}gone{% endif %}",
        ]));

        $this->assertNull($result['error'], 'a legitimate session use failed to render: '
            . ($result['error'] ? $result['error']->getMessage() : ''));
        $this->assertSame('vhasgone', trim($result['output']));
    }
}
