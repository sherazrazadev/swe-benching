<?php
/**
 * The legacy form-posted notifications the integration accepts keep working.
 */
final class FuncLegacyPostTest extends AnetTestCase
{
    private const SIGNATURE_KEY = '8f3c2a9b7e6d5c4a1b0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443';

    public function testMatchingLegacyPostCreditsThePayment(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = http_build_query([
            'x_trans_id' => '60000000001',
            'x_response_code' => '1',
            'x_amount' => '5.00',
            'x_cust_id' => '42',
        ]);

        $response = $this->post('/plugin/AuthorizeNet/silentPost.php', $body, [
            'Content-Type' => 'application/x-www-form-urlencoded',
        ], $runtime);

        $this->assertCredited($response, 42, 5.00, 'matching legacy post');
    }

    public function testLegacyPostWithoutAccountOrAmountUsesTheTransactionRecord(): void
    {
        $runtime = $this->runtime(self::SIGNATURE_KEY);
        $body = http_build_query([
            'x_trans_id' => '60000000003',
            'x_response_code' => '1',
        ]);

        $response = $this->post('/plugin/AuthorizeNet/silentPost.php', $body, [
            'Content-Type' => 'application/x-www-form-urlencoded',
        ], $runtime);

        $this->assertCredited($response, 42, 5.00, 'legacy post record fallback');
    }
}
