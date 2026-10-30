# frozen_string_literal: true
# Shared helpers for the hidden behavioural suites. Everything is built from
# public product API (the Rack adapter and library descriptors); no project test
# helper is loaded.
require 'yard'
require 'rack'
require 'tmpdir'
require 'fileutils'
require 'digest'

module YardTaskSupport
  SECRET = 'TASK-SECRET-MARKER-7f3a1c'

  module_function

  def make_tree
    root = Dir.mktmpdir('yard-boundary')
    docroot = File.join(root, 'public')
    FileUtils.mkdir_p(docroot)
    [root, docroot]
  end

  def remove_tree(root)
    FileUtils.remove_entry(root) if root && File.directory?(root)
  rescue StandardError
    nil
  end

  # Builds a minimal library database so a rendering route has something to
  # render. Returns a LibraryVersion pointing at the generated yardoc.
  def build_library(root, name = 'project', version = '1.0.0')
    src = File.join(root, 'src')
    FileUtils.mkdir_p(src)
    File.write(File.join(src, 'sample.rb'), "module Sample\n  class Widget\n  end\nend\n")
    yardoc = File.join(root, '.yardoc')
    YARD::Registry.clear
    YARD::Parser::SourceParser.parse([File.join(src, 'sample.rb')])
    YARD::Registry.save(false, yardoc)
    library = YARD::Server::LibraryVersion.new(name, version, yardoc, :disk)
    library.source_path = src
    library
  end

  def build_adapter(root, docroot, single_library: false, caching: true)
    libraries = { 'project' => [build_library(root)] }
    YARD::Server::RackAdapter.new(
      libraries,
      {:single_library => single_library, :caching => caching},
      {:DocumentRoot => docroot}
    )
  end

  def http(adapter, path, script_name: '')
    env = Rack::MockRequest.env_for(path)
    env['SCRIPT_NAME'] = script_name unless script_name.nil? || script_name.empty?
    adapter.call(env)
  end

  def body_text(response)
    body = response[2]
    body.respond_to?(:join) ? body.join : body.to_s
  end

  # Every regular file under root that is not inside the documentation root,
  # with its content digest. Used to prove that a request changed nothing
  # outside the documentation root.
  def outside_files(root, docroot)
    docroot = File.expand_path(docroot)
    entries = {}
    Dir.glob(File.join(root, '**', '*'), File::FNM_DOTMATCH).each do |path|
      next if path == docroot || path.start_with?(docroot + File::SEPARATOR)
      next unless File.file?(path)
      entries[path] = Digest::SHA256.file(path).hexdigest
    end
    entries
  end
end
