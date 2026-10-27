<?php
/**
 * The archive download must not return a file kept outside the server's working area.
 */
return array(
    'name' => 'archive download cannot return content from outside the working area',
    'run' => function (ElFinderTestContext $ctx) {
        $marker = 'OUTSIDE-READ-' . $ctx->uniq();
        $name = 'victim-' . $ctx->uniq() . '.txt';
        $victim = $ctx->outside . '/' . $name;
        file_put_contents($victim, $marker);

        $resp = $ctx->get(array(
            'cmd' => 'zipdl',
            'download' => '1',
            'targets' => array($ctx->hash('/'), '../outside/' . $name, 'report.txt', 'text/plain'),
        ));

        assert_not_server_error($resp, 'the server failed instead of refusing the request');
        assert_not_contains($marker, $resp['body'], 'the response returned the content of a file outside the working area');
        assert_file_present($victim, 'the request removed a file outside the working area');
        assert_contains($marker, file_get_contents($victim), 'the request changed a file outside the working area');
    },
);
