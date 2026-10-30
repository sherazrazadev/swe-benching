# frozen_string_literal: true
require_relative '../support/yard_spec_support'

# The documentation root is a boundary for every request-derived location the
# server resolves against it: no request may read, create, overwrite or remove a
# file outside it.
RSpec.describe 'documentation root boundary' do
  around do |example|
    @root, @docroot = YardTaskSupport.make_tree
    begin
      example.run
    ensure
      YardTaskSupport.remove_tree(@root)
    end
  end

  it 'does not return a page stored above the documentation root' do
    File.write(File.join(@root, 'secret.html'), YardTaskSupport::SECRET)
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    status, _headers, body = YardTaskSupport.http(adapter, '/../secret.html')

    expect(YardTaskSupport.body_text([status, _headers, body])).not_to include(YardTaskSupport::SECRET)
    expect(status).to be >= 400
    expect(status).to be < 500
  end

  it 'does not write a rendered page above the documentation root' do
    adapter = YardTaskSupport.build_adapter(@root, @docroot)
    before = YardTaskSupport.outside_files(@root, @docroot)

    YardTaskSupport.http(adapter, '/docs/project/1.0.0/../../../../toplevel')

    after = YardTaskSupport.outside_files(@root, @docroot)
    expect(after).to eq(before)
    expect(File.exist?(File.join(@root, 'toplevel.html'))).to be false
  end

  it 'does not create the index cache beside the documentation root' do
    adapter = YardTaskSupport.build_adapter(@root, @docroot)
    before = YardTaskSupport.outside_files(@root, @docroot)

    status, _headers, body = YardTaskSupport.http(adapter, '/')

    expect(status).to eq 200
    expect(body.join).not_to be_empty
    after = YardTaskSupport.outside_files(@root, @docroot)
    expect(after).to eq(before)
    expect(File.exist?(@docroot + '.html')).to be false
  end

  it 'does not remove a page from a directory that shares the root prefix' do
    sibling = @docroot + '-archive'
    FileUtils.mkdir_p(sibling)
    canary = File.join(sibling, 'secret.html')
    File.write(canary, YardTaskSupport::SECRET)
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    YardTaskSupport.http(adapter, "/purge/../#{File.basename(sibling)}/secret.html")

    expect(File.file?(canary)).to be true
    expect(File.read(canary)).to eq(YardTaskSupport::SECRET)
  end

  it 'does not serve an absolute path through the preview route' do
    secret = File.join(@root, 'secret.html')
    File.write(secret, YardTaskSupport::SECRET)
    adapter = YardTaskSupport.build_adapter(@root, @docroot)

    status, _headers, body = YardTaskSupport.http(adapter, '/preview/' + secret)

    expect(YardTaskSupport.body_text([status, _headers, body])).not_to include(YardTaskSupport::SECRET)
    expect(status).to be >= 400
    expect(status).to be < 500
  end
end
