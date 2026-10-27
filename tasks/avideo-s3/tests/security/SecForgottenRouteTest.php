<?php
/**
 * Every other route in the payment integration that can change a wallet balance must obey the
 * same invariant: the credit corresponds to a payment the gateway confirms, and the request
 * cannot choose the account or the amount.
 */
final class SecForgottenRouteTest extends AnetTestCase
{
    private const SIGNATURE_KEY = '8f3c2a9b7e6d5c4a1b0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443';

    public function testWalletTopUpEndpointDoesNotCreditWithoutAPayment(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);

        $response = $this->post('/plugin/AuthorizeNet/processPayment.json.php', 'amount=1000', [
            'Content-Type' => 'application/x-www-form-urlencoded',
        ], $runtime, 7, true);

        $this->assertClientError($response, 'wallet top-up');
        $this->assertNoCredit($response, 'wallet top-up');
    }

    public function testLegacyPostCannotChooseTheAccountOrAmount(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = http_build_query([
            'x_trans_id' => '60000000001',
            'x_response_code' => '1',
            'x_amount' => '1000',
            'x_cust_id' => '7',
        ]);

        $response = $this->post('/plugin/AuthorizeNet/silentPost.php', $body, [
            'Content-Type' => 'application/x-www-form-urlencoded',
        ], $runtime);

        $this->assertOnlyGatewayCredit($response, 42, 5.00, 'legacy post account and amount');
    }

    public function testRecurringNotificationCannotBypassAuthentication(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = AnetHarness::notification('60000000001', 7, '1000.00', '1');

        $response = $this->post('/plugin/AuthorizeNet/webhookSubscription.php', $body, [
            'Content-Type' => 'application/json',
            'X-ANET-Signature' => 'sha512=' . str_repeat('0', 128),
        ], $runtime);

        $this->assertClientError($response, 'recurring notification');
        $this->assertNoCredit($response, 'recurring notification');
    }
}
