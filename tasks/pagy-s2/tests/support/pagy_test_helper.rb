# frozen_string_literal: true

require 'minitest/autorun'
require 'minitest/reporters'
require 'tmpdir'
require 'fileutils'
require 'pathname'
require 'yaml'

require 'pagy'

# One JUnit file per runner process; test.sh copies it into the root-locked log dir.
Minitest::Reporters.use!(
  Minitest::Reporters::JUnitReporter.new(ENV.fetch('JUNIT_DIR'), true, single_file: true)
)
