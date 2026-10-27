<?php
/**
 * Ordinary browsing, folder creation, file creation and renaming still work.
 */
return array(
    'name' => 'browsing and ordinary creation still work',
    'run' => function (ElFinderTestContext $ctx) {
        $open = $ctx->get(array('cmd' => 'open', 'target' => $ctx->hash('/'), 'init' => '1'));
        assert_not_server_error($open, 'browsing the storage folder failed');
        $json = json_decode($open['body'], true);
        assert_true(is_array($json) && !empty($json['files']), 'browsing returned no files');

        $u = $ctx->uniq();
        $dir = 'folder-' . $u;
        $mkdir = $ctx->get(array('cmd' => 'mkdir', 'target' => $ctx->hash('/'), 'name' => $dir));
        assert_not_server_error($mkdir, 'mkdir failed');
        assert_true(is_dir($ctx->root . '/' . $dir), 'mkdir did not create the folder');

        $file = 'note-' . $u . '.txt';
        $mkfile = $ctx->get(array('cmd' => 'mkfile', 'target' => $ctx->hash('/'), 'name' => $file));
        assert_not_server_error($mkfile, 'mkfile failed');
        assert_file_present($ctx->root . '/' . $file, 'mkfile did not create the file');

        $renamed = 'renamed-' . $u . '.txt';
        $rename = $ctx->get(array('cmd' => 'rename', 'target' => $ctx->hash($file), 'name' => $renamed));
        assert_not_server_error($rename, 'rename failed');
        assert_file_present($ctx->root . '/' . $renamed, 'rename did not move the file');
        assert_file_missing($ctx->root . '/' . $file, 'rename left the old name behind');
    },
);
