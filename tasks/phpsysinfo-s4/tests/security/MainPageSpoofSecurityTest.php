<?php

/**
 * A client that is not on the allow list must not be admitted by anything it puts in the request.
 */
class MainPageSpoofSecurityTest extends HttpCase
{
    const PAGE = '/index.php?disp=xml';
    const MARKERS = array('<tns:phpsysinfo');

    public function testForwardedForDoesNotAdmitAnUnlistedClient()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get(self::PAGE, array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertBlocked($response, self::MARKERS, 'forwarded-for from an unlisted client');
    }

    public function testClientAddressHeaderDoesNotAdmitAnUnlistedClient()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get(self::PAGE, array('Client-IP' => '10.20.30.40'));
        $this->assertBlocked($response, self::MARKERS, 'client-address header from an unlisted client');
    }

    public function testForwardedAddressInsideAnAllowedRangeDoesNotAdmitAnUnlistedClient()
    {
        $this->useConfig('10.20.0.0/16');
        $response = $this->get(self::PAGE, array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertBlocked($response, self::MARKERS, 'forwarded address inside an allowed range');
    }

    public function testForwardedAddressFromAnUnlistedProxyDoesNotAdmitAnUnlistedClient()
    {
        $this->useConfig('10.20.30.40', '10.99.99.99');
        $response = $this->get(self::PAGE, array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertBlocked($response, self::MARKERS, 'forwarded address from a proxy that is not trusted');
    }

    public function testReferencingAProxyAddressDoesNotAdmitAnUnlistedClient()
    {
        // The supplied address is itself one of the configured proxy addresses, but the connection
        // did not come from it.
        $this->useConfig('10.20.30.40', '10.20.30.40');
        $response = $this->get(self::PAGE, array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertBlocked($response, self::MARKERS, 'a forwarded value that names a proxy address');
    }
}
