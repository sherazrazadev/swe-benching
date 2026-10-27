<?php
/**
 * A deeper parent path under an existing folder must not be stored outside the target folder.
 */
return array(
    'name' => 'a deeply nested uploaded item cannot be stored outside the target folder',
    'run' => function (ElFinderTestContext $ctx) {
        $u = $ctx->uniq();
        $escaped = $ctx->outside . '/evil-deep-' . $u . '.png';

        $resp = $ctx->postMultipart(
            array(
                'cmd' => 'upload',
                'target' => $ctx->hash('/'),
                'name[]' => 'sub/deep/../../../outside/evil-deep-' . $u . '.png',
            ),
            'upload[]',
            array(
                'filename' => 'image.png',
                'type' => 'image/png',
                'content' => "\x89PNG\r\n\x1a\n" . 'fixture-' . $u,
            )
        );

        assert_not_server_error($resp, 'the server failed instead of refusing the request');
        assert_file_missing($escaped, 'the request stored an uploaded item outside the target folder');
    },
);
