<?php
/**
 * A legitimate clipboard rename is honoured, and ordinary names (dots, a backslash) stay valid.
 */
return array(
    'name' => 'a chosen stored name and ordinary names still work',
    'run' => function (ElFinderTestContext $ctx) {
        $u = $ctx->uniq();
        $png = array('filename' => 'image.png', 'type' => 'image/png', 'content' => "\x89PNG\r\n\x1a\n" . $u);

        $renamed = 'custom-' . $u;
        $resp = $ctx->postMultipart(
            array('cmd' => 'upload', 'target' => $ctx->hash('/'), 'name[]' => $renamed),
            'upload[]', $png
        );
        assert_not_server_error($resp, 'the rename upload failed');
        assert_file_present($ctx->root . '/' . $renamed . '.png', 'a chosen name was not kept');

        $backslash = 'back\\slash-' . $u;
        $resp = $ctx->postMultipart(
            array('cmd' => 'upload', 'target' => $ctx->hash('/'), 'name[]' => $backslash),
            'upload[]', $png
        );
        assert_not_server_error($resp, 'the upload with a backslash in the name failed');
        assert_file_present($ctx->root . '/' . $backslash . '.png', 'a name with an ordinary backslash was refused');

        $dotted = 'note..2024-' . $u . '.txt';
        $resp = $ctx->postMultipart(
            array('cmd' => 'upload', 'target' => $ctx->hash('/')),
            'upload[]',
            array('filename' => $dotted, 'type' => 'text/plain', 'content' => 'dotted contents')
        );
        assert_not_server_error($resp, 'the upload with several dots failed');
        assert_file_present($ctx->root . '/' . $dotted, 'a name with several dots was refused');
    },
);
