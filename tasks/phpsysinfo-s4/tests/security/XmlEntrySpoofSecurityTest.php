<?php

/**
 * The data endpoint is reached through a different call path than the start page and must make
 * the same decision.
 */
class XmlEntrySpoofSecurityTest extends HttpCase
{
    public function testForwardedForDoesNotAdmitAnUnlistedClient()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get('/xml.php', array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertBlocked($response, array('<tns:phpsysinfo'), 'data endpoint with a forwarded address');
    }

    public function testClientAddressHeaderDoesNotAdmitAnUnlistedClient()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get('/xml.php', array('Client-IP' => '10.20.30.40'));
        $this->assertBlocked($response, array('<tns:phpsysinfo'), 'data endpoint with a client address header');
    }
}
