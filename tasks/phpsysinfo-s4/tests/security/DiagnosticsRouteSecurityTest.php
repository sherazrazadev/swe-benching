<?php

/**
 * Reports that describe the machine are only for clients the allow list admits.
 */
class DiagnosticsRouteSecurityTest extends HttpCase
{
    const CPU_MARKERS = array('----------/proc/cpuinfo----------', 'processor');
    const DISTRO_MARKERS = array('PRETTY_NAME=', '----------/etc/os-release----------');

    public function testCpuReportIsNotServedToAnUnlistedClient()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get('/tools/cputest.php');
        $this->assertBlocked($response, self::CPU_MARKERS, 'cpu report to an unlisted client');
    }

    public function testCpuReportIsNotOpenedByAForwardedAddress()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get('/tools/cputest.php', array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertBlocked($response, self::CPU_MARKERS, 'cpu report opened by a forwarded address');
    }

    public function testDistributionReportIsNotServedToAnUnlistedClient()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get('/tools/distrotest.php');
        $this->assertBlocked($response, self::DISTRO_MARKERS, 'distribution report to an unlisted client');
    }

    public function testDistributionReportIsNotOpenedByAForwardedAddress()
    {
        $this->useConfig('10.20.30.40');
        $response = $this->get('/tools/distrotest.php', array('X-Forwarded-For' => '10.20.30.40'));
        $this->assertBlocked($response, self::DISTRO_MARKERS, 'distribution report opened by a forwarded address');
    }
}
