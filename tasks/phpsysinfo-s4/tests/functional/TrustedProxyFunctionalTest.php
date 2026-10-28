<?php

/**
 * A deployment behind a reverse proxy the operator designated must keep identifying the clients
 * the proxy reports.
 */
class TrustedProxyFunctionalTest extends HttpCase
{
    const PAGE = '/index.php?disp=xml';
    const MARKER = '<tns:phpsysinfo';

    public function testClientReportedByATrustedProxyIsServed()
    {
        $this->useConfig('10.20.30.40', '127.0.0.1');
        $response = $this->get(self::PAGE, array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertServed($response, self::MARKER, 'client reported by a trusted proxy');
    }

    public function testClientReportedThroughTheClientAddressHeaderIsServed()
    {
        $this->useConfig('10.20.30.40', '127.0.0.1');
        $response = $this->get(self::PAGE, array('Client-IP' => '10.20.30.40'));
        $this->assertServed($response, self::MARKER, 'client reported through the client address header');
    }

    public function testClientReportedInMappedIpv4FormIsServed()
    {
        $this->useConfig('10.20.30.40', '127.0.0.1');
        $response = $this->get(self::PAGE, array('X-Forwarded-For' => '::ffff:10.20.30.40'));
        $this->assertServed($response, self::MARKER, 'client reported in mapped IPv4 form');
    }

    public function testTrustedProxyRangeIsAccepted()
    {
        $this->useConfig('10.20.30.40', '127.0.0.0/8');
        $response = $this->get(self::PAGE, array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertServed($response, self::MARKER, 'trusted proxy inside a listed range');
    }
}
