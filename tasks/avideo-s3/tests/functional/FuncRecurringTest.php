<?php
/**
 * Authenticated recurring-billing notifications keep crediting their payments.
 */
final class FuncRecurringTest extends AnetTestCase
{
    private const SIGNATURE_KEY = '8f3c2a9b7e6d5c4a1b0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443';

    public function testCorrectlySignedRecurringNotificationCredits(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000001', 42, '5.00', '1');

        $response = $this->post('/plugin/AuthorizeNet/webhookSubscription.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => AnetHarness::sign($body, self::SIGNATURE_KEY),
        ], $runtime);

        $this->assertCredited($response, 42, 5.00, 'recurring notification');
    }

    public function testRecurringNotificationCreditsItsOwnAccount(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000004', 43, '7.50', '1');

        $response = $this->post('/plugin/AuthorizeNet/webhookSubscription.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => AnetHarness::sign($body, self::SIGNATURE_KEY),
        ], $runtime);

        $this->assertCredited($response, 43, 7.50, 'recurring second account');
    }
}
