# frozen_string_literal: true
require_relative '../support/yard_spec_support'

# Ordinary documentation-server behaviour must keep working exactly as before.
RSpec.describe 'documentation server behaviour' do
  around do |example|
    @root, @docroot = YardTaskSupport.make_tree
    begin
      example.run
    ensure
      YardTaskSupport.remove_tree(@root)
    end
  end

  it 'serves a cached page from the documentation root' do
    FileUtils.mkdir_p(File.join(@docroot, 'hello'))
    File.write(File.join(@docroot, 'hello', 'world.html'), 'HELLO-WORLD')
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    status, _headers, body = YardTaskSupport.http(adapter, '/hello/world.html')

    expect(status).to eq 200
    expect(body.join).to include('HELLO-WORLD')
  end

  it 'serves a cached page requested without the html suffix' do
    FileUtils.mkdir_p(File.join(@docroot, 'hello'))
    File.write(File.join(@docroot, 'hello', 'world.html'), 'HELLO-WORLD')
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    status, _headers, body = YardTaskSupport.http(adapter, '/hello/world')

    expect(status).to eq 200
    expect(body.join).to include('HELLO-WORLD')
  end

  it 'keeps the mount prefix in the cache location' do
    FileUtils.mkdir_p(File.join(@docroot, 'mount', 'point', 'hello'))
    File.write(File.join(@docroot, 'mount', 'point', 'hello', 'world.html'), 'MOUNTED-PAGE')
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    status, _headers, body =
      YardTaskSupport.http(adapter, '/hello/world.html', script_name: '/mount/point')

    expect(status).to eq 200
    expect(body.join).to include('MOUNTED-PAGE')
  end

  it 'serves a page whose name merely contains two dots' do
    FileUtils.mkdir_p(File.join(@docroot, 'hello'))
    File.write(File.join(@docroot, 'hello', 'a..b.html'), 'DOTS-ARE-JUST-A-NAME')
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    status, _headers, body = YardTaskSupport.http(adapter, '/hello/a..b.html')

    expect(status).to eq 200
    expect(body.join).to include('DOTS-ARE-JUST-A-NAME')
  end

  it 'caches a rendered page inside the documentation root' do
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    response = YardTaskSupport.http(adapter, '/docs/project/1.0.0/toplevel')

    expect(response[0]).to eq 200
    cached = File.join(@docroot, 'docs', 'project', '1.0.0', 'toplevel.html')
    expect(File.file?(cached)).to be true
    expect(File.read(cached)).to eq response[2].join
  end

  it 'serves a previously cached page for a documentation route' do
    cached = File.join(@docroot, 'docs', 'project', '1.0.0', 'toplevel.html')
    FileUtils.mkdir_p(File.dirname(cached))
    File.write(cached, 'CACHED-PAGE-CONTENT')
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    response = YardTaskSupport.http(adapter, '/docs/project/1.0.0/toplevel')

    expect(response[0]).to eq 200
    expect(response[2].join).to eq 'CACHED-PAGE-CONTENT'
  end

  it 'removes an in-root cached page on request' do
    FileUtils.mkdir_p(File.join(@docroot, 'hello'))
    page = File.join(@docroot, 'hello', 'world.html')
    File.write(page, 'HELLO-WORLD')
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    YardTaskSupport.http(adapter, '/purge/hello/world.html')

    expect(File.exist?(page)).to be false
  end

  it 'serves an in-root cached page through the preview route' do
    FileUtils.mkdir_p(File.join(@docroot, 'hello'))
    File.write(File.join(@docroot, 'hello', 'world.html'), 'PREVIEW-CONTENT')
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    status, _headers, body = YardTaskSupport.http(adapter, '/preview/hello/world.html')

    expect(status).to eq 200
    expect(body.join).to include('PREVIEW-CONTENT')
  end

  it 'serves a static asset from the documentation root' do
    File.write(File.join(@docroot, 'app.css'), 'body { color: purple; }')
    adapter = YardTaskSupport.build_adapter(@root, @docroot, single_library: true)

    status, _headers, body = YardTaskSupport.http(adapter, '/static/app.css')

    expect(status).to eq 200
    expect(body.join).to include('color: purple')
  end

  it 'still serves the documentation index' do
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    status, _headers, body = YardTaskSupport.http(adapter, '/')

    expect(status).to eq 200
    expect(body.join).to include('project')
  end
end
