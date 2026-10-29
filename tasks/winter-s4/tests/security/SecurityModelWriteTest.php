<?php

/**
 * Stored records supplied to a template must not be changed by it, through the model or
 * through the query object reached from it.
 */
class SecurityModelWriteTest extends WinterHiddenCase
{
    public function testStoredRecordCannotBeChangedThroughAQuietSave(): void
    {
        $this->setUpDatabase();
        $item = $this->makeItem('original');

        $result = $this->renderTemplate(
            "{{ model.forceFill({ name: 'compromised' }).saveQuietly() }}",
            ['model' => $item]
        );

        $this->assertSame('original', WinterHiddenItem::find($item->id)->name);
        $this->assertNotNull($result['error'], 'the render that would change the record was not refused with an error');
    }

    public function testStoredRecordCannotBeChangedThroughAForwardedCounter(): void
    {
        $this->setUpDatabase();
        $item = $this->makeItem('original');

        $result = $this->renderTemplate("{{ model.increment('count', 7) }}", ['model' => $item]);

        $this->assertSame(1, (int) WinterHiddenItem::find($item->id)->count);
        $this->assertNotNull($result['error'], 'the render that would change the record was not refused with an error');
    }

    public function testStoredRecordCannotBeChangedThroughAQueryObject(): void
    {
        $this->setUpDatabase();
        $item = $this->makeItem('original');

        $result = $this->renderTemplate(
            "{{ model.newQuery().update({ name: 'compromised' }) }}",
            ['model' => $item]
        );

        $this->assertSame('original', WinterHiddenItem::find($item->id)->name);
        $this->assertNotNull($result['error'], 'the render that would change the record was not refused with an error');
    }
}
