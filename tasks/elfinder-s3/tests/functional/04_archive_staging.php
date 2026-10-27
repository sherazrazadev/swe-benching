<?php
/**
 * Archive creation with an ordinary chosen name still works, and its staged copy is still kept.
 */
return array(
    'name' => 'archive creation with an ordinary name still works and keeps its staged copy',
    'run' => function (ElFinderTestContext $ctx) {
        $u = $ctx->uniq();
        $name = 'arch-' . $u . '-x';

        $resp = $ctx->get(array(
            'cmd' => 'archive',
            'targets' => array($ctx->hash('seed.txt')),
            'type' => 'application/x-tar',
            'name' => $name,
        ));
        assert_not_server_error($resp, 'archive creation failed');
        $json = json_decode($resp['body'], true);
        assert_true(is_array($json) && !empty($json['added']), 'archive creation returned no archive');
        assert_file_present($ctx->root . '/' . $name . '.tar', 'the archive was not created in the target folder');
        assert_file_present($ctx->tmp . '/' . $name, 'the archive staged copy was not kept');
    },
);
