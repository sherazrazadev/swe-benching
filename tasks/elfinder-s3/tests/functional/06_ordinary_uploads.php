<?php
/**
 * Ordinary uploads keep their own names, including one that starts with the text the clipboard
 * branch looks for, as long as the client does not ask for a different name.
 */
return array(
    'name' => 'ordinary uploads keep their own names',
    'run' => function (ElFinderTestContext $ctx) {
        $u = $ctx->uniq();
        $photo = 'photo-' . $u . '.png';
        $resp = $ctx->postMultipart(
            array('cmd' => 'upload', 'target' => $ctx->hash('/')),
            'upload[]',
            array('filename' => $photo, 'type' => 'image/png', 'content' => "\x89PNG\r\n\x1a\n" . $u)
        );
        assert_not_server_error($resp, 'the ordinary image upload failed');
        assert_file_present($ctx->root . '/' . $photo, 'the ordinary image upload did not keep its name');

        $imageNamed = 'image-' . $u . '.png';
        $resp = $ctx->postMultipart(
            array('cmd' => 'upload', 'target' => $ctx->hash('/')),
            'upload[]',
            array('filename' => $imageNamed, 'type' => 'image/png', 'content' => "\x89PNG\r\n\x1a\n" . $u)
        );
        assert_not_server_error($resp, 'the image-named upload failed');
        assert_file_present($ctx->root . '/' . $imageNamed, 'an ordinary name was refused');

        $note = 'note-' . $u . '.txt';
        $resp = $ctx->postMultipart(
            array('cmd' => 'upload', 'target' => $ctx->hash('/')),
            'upload[]',
            array('filename' => $note, 'type' => 'text/plain', 'content' => 'plain contents')
        );
        assert_not_server_error($resp, 'the ordinary text upload failed');
        assert_file_present($ctx->root . '/' . $note, 'the ordinary text upload did not keep its name');
    },
);
