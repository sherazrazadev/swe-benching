<?php

/**
 * Reads of stored values keep working, both through the model and through a query object.
 */
class FunctionalModelReadsTest extends WinterHiddenCase
{
    public function testStoredValuesStillReadAndCount(): void
    {
        $this->setUpDatabase();
        $item = $this->makeItem('readable');

        $result = $this->renderTemplate(implode('', [
            '{{ model.name }}',
            '|{{ model.getAttribute("name") }}',
            '|{{ model.newQuery().count() }}',
        ]), ['model' => $item]);

        $this->assertNull($result['error'], 'a legitimate model read failed to render: '
            . ($result['error'] ? $result['error']->getMessage() : ''));
        $this->assertSame('readable|readable|1', trim($result['output']));
    }
}
