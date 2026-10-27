<?php
/**
 * A nested archive-download name must not reach the parent of the working area either.
 */
return array(
    'name' => 'nested archive-download name cannot return content from outside the working area',
    'run' => function (ElFinderTestContext $ctx) {
        $marker = 'OUTSIDE-NESTED-' . $ctx->uniq();
        $name = 'victim-nested-' . $ctx->uniq() . '.txt';
        $victim = $ctx->outside . '/' . $name;
        file_put_contents($victim, $marker);

        $resp = $ctx->get(array(
            'cmd' => 'zipdl',
            'download' => '1',
            'targets' => array($ctx->hash('/'), 'sub/../../outside/' . $name, 'report.txt', 'text/plain'),
        ));

        assert_not_server_error($resp, 'the server failed instead of refusing the request');
        assert_not_contains($marker, $resp['body'], 'the response returned the content of a file outside the working area');
        assert_file_present($victim, 'the request removed a file outside the working area');
    },
);
