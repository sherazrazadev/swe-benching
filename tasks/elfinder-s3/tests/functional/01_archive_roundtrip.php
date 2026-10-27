<?php
/**
 * The two-step archive download keeps working: the server hands out a working-file name and
 * accepts that name back to stream the archive.
 */
return array(
    'name' => 'archive download round trip still works',
    'run' => function (ElFinderTestContext $ctx) {
        $source = 'archive-me-' . $ctx->uniq() . '.txt';
        file_put_contents($ctx->root . '/' . $source, "archived content\n");

        $first = $ctx->get(array('cmd' => 'zipdl', 'targets' => array($ctx->hash($source))));
        assert_not_server_error($first, 'the archive request failed');
        $data = json_decode($first['body'], true);
        assert_true(is_array($data) && isset($data['zipdl']['file']), 'the archive request did not return a working-file name');
        $temp = $data['zipdl']['file'];
        assert_true(is_string($temp) && $temp !== '' && strpos($temp, '/') === false, 'the returned working-file name is not a plain name');

        $second = $ctx->get(array(
            'cmd' => 'zipdl',
            'download' => '1',
            'targets' => array($ctx->hash('/'), $temp, $data['zipdl']['name'], $data['zipdl']['mime']),
        ));
        assert_not_server_error($second, 'the download of the archive failed');
        assert_true($second['status'] === 200, 'the archive download did not return content (status ' . $second['status'] . ')');
        assert_true(strlen($second['body']) > 0, 'the archive download was empty');
        assert_file_present($ctx->root . '/' . $source, 'the source file disappeared during the download');
    },
);
