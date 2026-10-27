<?php
/**
 * The archive operation's staged copy must not be written outside the server's working area.
 */
return array(
    'name' => 'archive staging cannot write outside the working area',
    'run' => function (ElFinderTestContext $ctx) {
        $u = $ctx->uniq();
        $escaped = $ctx->outside . '/evilarch-' . $u;

        $resp = $ctx->get(array(
            'cmd' => 'archive',
            'targets' => array($ctx->hash('seed.txt')),
            'type' => 'application/x-tar',
            'name' => 'sub/../../outside/evilarch-' . $u,
        ));

        assert_not_server_error($resp, 'the server failed instead of handling the request');
        assert_file_missing($escaped, 'the archive operation wrote a staged copy outside the working area');
    },
);
