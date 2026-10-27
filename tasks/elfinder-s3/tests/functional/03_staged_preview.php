<?php
/**
 * A file staged under a plain name in the working area is still served, and the ordinary file
 * download of a stored item still works.
 */
return array(
    'name' => 'a plain staged working file and an ordinary file download still work',
    'run' => function (ElFinderTestContext $ctx) {
        $u = $ctx->uniq();
        $staged = 'staged-' . $u . '.txt';
        $marker = 'STAGED-CONTENT-' . $u;
        file_put_contents($ctx->tmp . '/' . $staged, $marker);

        $resp = $ctx->get(array(
            'cmd' => 'file',
            'target' => $ctx->hash('seed.txt'),
            'download' => '1',
            'tmp' => $staged,
        ));
        assert_not_server_error($resp, 'serving a plain staged file failed');
        assert_contains($marker, $resp['body'], 'a plain staged working file was not served');

        $plain = $ctx->get(array('cmd' => 'file', 'target' => $ctx->hash('seed.txt'), 'download' => '1'));
        assert_not_server_error($plain, 'the ordinary file download failed');
        assert_contains('fixture seed', $plain['body'], 'the ordinary file download returned no content');
    },
);
