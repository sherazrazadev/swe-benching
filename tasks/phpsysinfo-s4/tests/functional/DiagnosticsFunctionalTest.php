<?php

/**
 * The machine reports stay available to clients the allow list admits.
 */
class DiagnosticsFunctionalTest extends HttpCase
{
    public function testCpuReportIsServedToAListedAddress()
    {
        $this->useConfig('127.0.0.1');
        $this->assertServed(
            $this->get('/tools/cputest.php'),
            '----------/proc/cpuinfo----------',
            'cpu report for a listed address'
        );
    }

    public function testDistributionReportIsServedToAListedAddress()
    {
        $this->useConfig('127.0.0.1');
        $this->assertServed($this->get('/tools/distrotest.php'), 'PRETTY_NAME=', 'distribution report for a listed address');
    }

    public function testRuntimeReportIsServedToAListedAddress()
    {
        $this->useConfig('127.0.0.1');
        $this->assertServed($this->get('/tools/phptest.php'), 'SERVER SOFTWARE:', 'runtime report for a listed address');
    }

    public function testRuntimeReportIsServedToAClientOfATrustedProxy()
    {
        $this->useConfig('10.20.30.40', '127.0.0.1');
        $response = $this->get('/tools/phptest.php', array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertServed($response, 'SERVER SOFTWARE:', 'runtime report for a client of a trusted proxy');
    }
}
