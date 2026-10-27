<?php
/**
 * The payment notification endpoint.
 *
 * Each test sends one notification to the product's real HTTP endpoint and observes the wallet
 * balance changes it caused. A forged or unauthenticated notification must not credit anything;
 * a notification that is authentic must not let the request choose the account or the amount.
 */
final class SecNotificationTest extends AnetTestCase
{
    private const SIGNATURE_KEY = '8f3c2a9b7e6d5c4a1b0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443';

    public function testForgedNotificationDoesNotCreditAnything(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000001', 7, '1000.00', '1');

        $response = $this->post('/plugin/AuthorizeNet/webhook.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => 'sha512=' . str_repeat('0', 128),
        ], $runtime);

        $this->assertClientError($response, 'forged signature');
        $this->assertNoCredit($response, 'forged signature');
    }

    public function testNotificationWhenNoSignatureKeyIsConfiguredDoesNotCredit(): void
    {
        $runtime = $this->runtime('');
        $body = AnetHarness::notification('60000000001', 7, '1000.00', '1');

        $response = $this->post('/plugin/AuthorizeNet/webhook.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => 'sha512=' . str_repeat('a', 128),
        ], $runtime);

        $this->assertClientError($response, 'no configured key');
        $this->assertNoCredit($response, 'no configured key');
    }

    public function testAuthenticNotificationCannotChooseAnotherAccountOrAmount(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000001', 7, '999.00', '1');
        $signature = AnetHarness::sign($body, self::SIGNATURE_KEY);

        $response = $this->post('/plugin/AuthorizeNet/webhook.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => $signature,
        ], $runtime);

        $this->assertOnlyGatewayCredit($response, 42, 5.00, 'account and amount from the request');
    }

    public function testDeclinedTransactionIsNotCredited(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        // The request claims approval; the gateway says the charge was declined.
        $body = AnetHarness::notification('60000000002', 42, '5.00', '1');
        $signature = AnetHarness::sign($body, self::SIGNATURE_KEY);

        $response = $this->post('/plugin/AuthorizeNet/webhook.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => $signature,
        ], $runtime);

        $this->assertNoCredit($response, 'declined transaction');
    }
}
