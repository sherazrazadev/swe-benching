<?php
/**
 * Legitimate payments through the notification endpoint keep working.
 */
final class FuncNotificationTest extends AnetTestCase
{
    private const SIGNATURE_KEY = '8f3c2a9b7e6d5c4a1b0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443';

    public function testGenuineNotificationCreditsTheGatewayPayment(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000001', 42, '5.00', '1');

        $response = $this->post('/plugin/AuthorizeNet/webhook.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => AnetHarness::sign($body, self::SIGNATURE_KEY),
        ], $runtime);

        $this->assertCredited($response, 42, 5.00, 'genuine notification');
    }

    public function testGenuineNotificationWithoutBodyFieldsUsesTheTransactionRecord(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000001', null, null, null);

        $response = $this->post('/plugin/AuthorizeNet/webhook.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => AnetHarness::sign($body, self::SIGNATURE_KEY),
        ], $runtime);

        $this->assertCredited($response, 42, 5.00, 'transaction record fallback');
    }

    public function testGenuineNotificationWithCamelCaseStatusCredits(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000003', 42, '5.00', '1');

        $response = $this->post('/plugin/AuthorizeNet/webhook.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => AnetHarness::sign($body, self::SIGNATURE_KEY),
        ], $runtime);

        $this->assertCredited($response, 42, 5.00, 'camel case status');
    }

    public function testGenuinePaymentForAnotherAccountCreditsThatAccount(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000004', 43, '7.50', '1');

        $response = $this->post('/plugin/AuthorizeNet/webhook.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => AnetHarness::sign($body, self::SIGNATURE_KEY),
        ], $runtime);

        $this->assertCredited($response, 43, 7.50, 'second buyer');
    }

    public function testUnrelatedEventIsIgnoredWithoutCredit(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000001', 42, '5.00', '1',
            'net.authorize.payment.void.created');

        $response = $this->post('/plugin/AuthorizeNet/webhook.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => AnetHarness::sign($body, self::SIGNATURE_KEY),
        ], $runtime);

        $this->assertLessThan(500, $response['status']);
        $this->assertNoCredit($response, 'unrelated event');
    }
}
