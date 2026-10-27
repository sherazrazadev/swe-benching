<?php
/**
 * The archive download's working-file name must not address a stored item in the storage folder.
 */
return array(
    'name' => 'archive-download name cannot return or remove a stored item',
    'run' => function (ElFinderTestContext $ctx) {
        $marker = 'STORED-ITEM-' . $ctx->uniq();
        $name = 'secret-' . $ctx->uniq() . '.txt';
        $victim = $ctx->root . '/' . $name;
        file_put_contents($victim, $marker);

        $resp = $ctx->get(array(
            'cmd' => 'zipdl',
            'download' => '1',
            'targets' => array($ctx->hash('/'), '../root/' . $name, 'report.txt', 'text/plain'),
        ));

        assert_not_server_error($resp, 'the server failed instead of refusing the request');
        assert_not_contains($marker, $resp['body'], 'the response returned a stored item through a working-file name');
        assert_file_present($victim, 'the request removed a stored item through a working-file name');
        assert_contains($marker, file_get_contents($victim), 'the request changed a stored item through a working-file name');
    },
);
