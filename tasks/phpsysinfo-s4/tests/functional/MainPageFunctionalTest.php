<?php

/**
 * Everyday use: a client the operator admitted keeps getting the product's output.
 */
class MainPageFunctionalTest extends HttpCase
{
    const PAGE = '/index.php?disp=xml';
    const MARKER = '<tns:phpsysinfo';

    public function testListedAddressIsServed()
    {
        $this->useConfig('127.0.0.1');
        $this->assertServed($this->get(self::PAGE), self::MARKER, 'listed address');
    }

    public function testListedAddressThatSendsItsOwnAddressForwardedIsServed()
    {
        $this->useConfig('127.0.0.1');
        $response = $this->get(self::PAGE, array('X-Forwarded-For' => '127.0.0.1'));
        $this->assertServed($response, self::MARKER, 'listed address sending its own address');
    }

    public function testAddressInsideAListedRangeIsServed()
    {
        $this->useConfig('127.0.0.0/8');
        $this->assertServed($this->get(self::PAGE), self::MARKER, 'address inside a listed range');
    }

    public function testDataEndpointIsServedToAListedAddress()
    {
        $this->useConfig('127.0.0.1');
        $this->assertServed($this->get('/xml.php'), self::MARKER, 'data endpoint for a listed address');
    }
}
