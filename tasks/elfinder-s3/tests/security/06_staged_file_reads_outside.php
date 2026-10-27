<?php
/**
 * A working-file name supplied to the file-download route must not return a file outside the
 * server's working area.
 */
return array(
    'name' => 'a supplied working-file name cannot return content from outside the working area',
    'run' => function (ElFinderTestContext $ctx) {
        $marker = 'OUTSIDE-PREVIEW-' . $ctx->uniq();
        $name = 'victim-preview-' . $ctx->uniq() . '.txt';
        $victim = $ctx->outside . '/' . $name;
        file_put_contents($victim, $marker);

        $resp = $ctx->get(array(
            'cmd' => 'file',
            'target' => $ctx->hash('seed.txt'),
            'download' => '1',
            'tmp' => 'sub/../../outside/' . $name,
        ));

        assert_not_server_error($resp, 'the server failed instead of refusing the request');
        assert_not_contains($marker, $resp['body'], 'the response returned a file outside the working area');
        assert_file_present($victim, 'the request removed a file outside the working area');
    },
);
