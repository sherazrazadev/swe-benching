#!/usr/bin/env python3
"""Hidden-test scenario runner: builds a fake ComfyUI host, imports the product
module under test in a fresh interpreter, and performs one action.

Usage:
  python -I scenario.py --repo DIR --root DIR --mode MODE --params FILE

It prints one JSON object on stdout.  Product code is never imported by the
test's own bookkeeping; everything the product touches lives under --root.
"""
import argparse
import json
import os
import sys
import traceback

STUB_FOLDER_PATHS = r'''
import os
user_directory = os.environ['FAKE_USER_DIR']
models_dir = os.environ['FAKE_MODELS_DIR']
folder_names_and_paths = {}
def get_user_directory():
    return user_directory
def get_folder_paths(name):
    if name == 'custom_nodes':
        return [os.environ['FAKE_CUSTOM_NODES_DIR']]
    return [os.path.join(models_dir, name)]
def get_filename_list(name):
    return []
if os.environ.get('FAKE_SYSTEM_USER_API') == '1':
    def get_system_user_directory():
        return os.environ['FAKE_SYSTEM_USER_DIR']
'''

STUB_SERVER = r'''
from aiohttp import web
class _PromptServerInstance:
    def __init__(self):
        self.routes = web.RouteTableDef()
class PromptServer:
    instance = _PromptServerInstance()
'''

STUB_LATENT = r'''
from enum import Enum
class LatentPreviewMethod(Enum):
    NoPreviews = 'none'
    Auto = 'auto'
    Latent2RGB = 'latent2rgb'
    TAESD = 'taesd'
'''

STUB_CLI_ARGS = r'''
import os
from types import SimpleNamespace
args = SimpleNamespace(listen=os.environ.get('FAKE_LISTEN', '127.0.0.1'))
args.preview_method = None
'''


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def build_host(root, system_api):
    dirs = {}
    for name in ('user', 'system_user', 'custom_nodes', 'models', 'comfyui', 'stubs'):
        dirs[name] = os.path.join(root, name)
        os.makedirs(dirs[name], exist_ok=True)
    stubs = dirs['stubs']
    write(os.path.join(stubs, 'folder_paths.py'), STUB_FOLDER_PATHS)
    write(os.path.join(stubs, 'nodes.py'), '')
    write(os.path.join(stubs, 'server.py'), STUB_SERVER)
    write(os.path.join(stubs, 'latent_preview.py'), STUB_LATENT)
    write(os.path.join(stubs, 'comfy', '__init__.py'), '')
    write(os.path.join(stubs, 'comfy', 'cli_args.py'), STUB_CLI_ARGS)
    write(os.path.join(stubs, 'utils', '__init__.py'), '')
    write(os.path.join(stubs, 'utils', 'extra_config.py'), '')
    write(os.path.join(dirs['comfyui'], 'requirements.txt'), 'torch\n')
    return dirs


def activate(dirs, system_api):
    os.environ.update({
        'FAKE_USER_DIR': dirs['user'],
        'FAKE_SYSTEM_USER_DIR': dirs['system_user'],
        'FAKE_CUSTOM_NODES_DIR': dirs['custom_nodes'],
        'FAKE_MODELS_DIR': dirs['models'],
        'FAKE_SYSTEM_USER_API': '1' if system_api else '0',
        'COMFYUI_PATH': dirs['comfyui'],
        'COMFYUI_FOLDERS_BASE_PATH': dirs['comfyui'],
    })
    paths = [dirs['stubs'], os.path.join(REPO, 'glob'), REPO]
    for p in paths:
        if p not in sys.path:
            sys.path.insert(0, p)
    os.environ['PYTHONPATH'] = dirs['stubs']


def legacy_manager_dir(dirs):
    return os.path.join(dirs['user'], 'default', 'ComfyUI-Manager')


def plant(dirs, files):
    """files: {relative path under the legacy manager dir: text}"""
    base = legacy_manager_dir(dirs)
    for rel, text in (files or {}).items():
        p = os.path.join(base, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(text)


def import_core():
    import manager_core as core
    return core


def import_server():
    import threading
    # The module starts a background cache-refresh thread at import; the
    # verifier is offline, so keep that one thread from running (other
    # threads, e.g. progress reporters, must keep working).
    original_start = threading.Thread.start

    def start(self, *args, **kwargs):
        target = getattr(self, '_target', None)
        if getattr(target, '__module__', None) == 'manager_server':
            return None
        return original_start(self, *args, **kwargs)

    threading.Thread.start = start
    try:
        import manager_server
    finally:
        threading.Thread.start = original_start
    return manager_server


def import_prestartup():
    import builtins
    builtins.exit = lambda *a, **k: None          # the startup hook restarts the process
    os.execv = lambda *a, **k: None
    import prestartup_script
    return prestartup_script


def write_manager_config(core, text):
    path = core.manager_config_path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return path


def create_snapshot(core, name, content='{}'):
    path = os.path.join(core.manager_snapshot_path, name + '.json')
    os.makedirs(core.manager_snapshot_path, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return path


def do_server(params):
    import asyncio
    import aiohttp
    from aiohttp import web
    prepared = {}
    core = None
    if params.get('write_config_in_manager') or params.get('create_snapshot') or params.get('write_trust'):
        core = import_core()
        prepared['manager_files_path'] = core.manager_files_path
        if params.get('write_config_in_manager') is not None:
            prepared['config_path'] = write_manager_config(core, params['write_config_in_manager'])
        if params.get('write_trust'):
            path = os.path.join(core.manager_files_path, 'trusted_sources.list')
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(params['write_trust'])
            prepared['trust_path'] = path
        if params.get('create_snapshot'):
            prepared['snapshot_path'] = create_snapshot(core, params['create_snapshot'], params.get('snapshot_content', '{}'))
    server = import_server()

    # A live client can write the user folder at any point, not only before startup.
    plant(DIRS, params.get('plant_after_start', {}))

    out = {
        'manager_files_path': server.core.manager_files_path,
        'manager_config_path': server.core.manager_config_path,
        'manager_snapshot_path': server.core.manager_snapshot_path,
        'manager_startup_script_path': server.core.manager_startup_script_path,
        'security_level': server.core.get_config()['security_level'],
        'statuses': [],
    }
    out.update(prepared)

    async def run():
        app = web.Application()
        app.add_routes(server.routes)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '127.0.0.1', 0)
        await site.start()
        port = site._server.sockets[0].getsockname()[1]
        async with aiohttp.ClientSession() as sess:
            for req in params.get('requests', []):
                method = req.get('method', 'GET').upper()
                url = f"http://127.0.0.1:{port}{req['path']}"
                kwargs = {}
                if 'body' in req:
                    kwargs['data'] = req['body']
                async with sess.request(method, url, **kwargs) as resp:
                    out['statuses'].append({'status': resp.status, 'path': req['path']})
        await runner.cleanup()

    asyncio.run(run())
    return out


def do_core(params):
    core = import_core()
    out = {
        'manager_files_path': core.manager_files_path,
        'manager_config_path': core.manager_config_path,
        'manager_startup_script_path': core.manager_startup_script_path,
    }
    if 'write_config' in params:
        out['config_path'] = write_manager_config(core, params['write_config'])
    if params.get('write_config_in_manager') is not None:
        out['config_path'] = write_manager_config(core, params['write_config_in_manager'])

    if params.get('call_get_config') or params.get('call_write_config'):
        out['effective_config'] = core.get_config()
    if params.get('call_write_config'):
        core.write_config()
    if 'reserve_script' in params:
        rs = params['reserve_script']
        core.reserve_script(rs['cwd'], rs['cmd'])
    if params.get('create_snapshot'):
        out['snapshot_path'] = create_snapshot(core, params['create_snapshot'], params.get('snapshot_content', '{}'))

    out['config'] = core.get_config()
    config_file = None
    if os.path.exists(core.manager_config_path):
        with open(core.manager_config_path, 'r', encoding='utf-8') as f:
            config_file = f.read()
    out['config_file'] = config_file
    return out


def do_prestartup(params):
    prestartup = import_prestartup()
    import ssl
    import cm_global
    out = {
        'manager_files_path': prestartup.manager_files_path,
        'manager_config_path': prestartup.manager_config_path,
        'default_conf': dict(prestartup.default_conf),
        'tls_unverified': ssl._create_default_https_context is ssl._create_unverified_context,
        'pip_overrides': dict(getattr(cm_global, 'pip_overrides', {})),
        'pip_blacklist': sorted(getattr(cm_global, 'pip_blacklist', set())),
        'pip_downgrade_blacklist': sorted(getattr(cm_global, 'pip_downgrade_blacklist', [])),
        'file_logging': getattr(prestartup, 'enable_file_logging', None),
        'restart_requested': os.path.exists(os.environ.get('__COMFY_CLI_SESSION__', '') + '.reboot'),
    }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--root', required=True)
    ap.add_argument('--mode', required=True)
    ap.add_argument('--system-api', choices=['0', '1'], default='1')
    ap.add_argument('--params', required=True)
    args = ap.parse_args()

    global REPO
    REPO = os.path.abspath(args.repo)
    root = os.path.abspath(args.root)
    with open(args.params, encoding='utf-8') as f:
        params = json.load(f)

    dirs = build_host(root, args.system_api == '1')
    global DIRS
    DIRS = dirs
    activate(dirs, args.system_api == '1')
    plant(dirs, params.get('plant', {}))

    os.environ['__COMFY_CLI_SESSION__'] = os.path.join(root, 'session')

    out = {}
    try:
        if args.mode == 'server':
            out = do_server(params)
        elif args.mode == 'core':
            out = do_core(params)
        elif args.mode == 'prestartup':
            out = do_prestartup(params)
        else:
            raise SystemExit('unknown mode ' + args.mode)
        out['ok'] = True
    except BaseException as e:  # never let a harness detail hide the observation
        out = {'ok': False, 'exception': type(e).__name__, 'traceback': traceback.format_exc()}
    print(json.dumps(out))


REPO = ''
DIRS = {}
if __name__ == '__main__':
    main()
