<?php

/**
 * The runtime report checks its caller itself. Its own check must reach the same decision as the
 * shared one: the address the connection came from, not an address the request supplies.
 */
class DiagnosticsDuplicateResolverSecurityTest extends HttpCase
{
    const MARKERS = array('SERVER SOFTWARE:', 'PHP VERSION:');

    public function testRuntimeReportIsNotOpenedByAForwardedAddress()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get('/tools/phptest.php', array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertBlocked($response, self::MARKERS, 'runtime report opened by a forwarded address');
    }

    public function testRuntimeReportIsNotOpenedByAClientAddressHeader()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get('/tools/phptest.php', array('Client-IP' => '10.20.30.40'));
        $this->assertBlocked($response, self::MARKERS, 'runtime report opened by a client address header');
    }

    public function testRuntimeReportIsNotOpenedThroughAnUnlistedProxy()
    {
        $this->useConfig('10.20.30.40', '10.99.99.99');
        $response = $this->get('/tools/phptest.php', array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertBlocked($response, self::MARKERS, 'runtime report opened through an unlisted proxy');
    }
}
