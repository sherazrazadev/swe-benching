# frozen_string_literal: true

require 'minitest/autorun'
require 'minitest/spec'
require 'minitest/reporters'

Minitest::Reporters.use!(
  Minitest::Reporters::JUnitReporter.new(ENV.fetch('JUNIT_DIR'), true, single_file: true)
)

$LOAD_PATH.unshift File.expand_path(__dir__)
require_relative 'unit/pagy/modules/i18n/locales_test'
