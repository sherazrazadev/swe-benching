# frozen_string_literal: true

require_relative '../support/pagy_test_helper'
require 'i18n'
require 'pagy/classes/calendar/calendar'

# Legitimate calendar locale setup still registers its locale files.
class CalendarUseFunctionalTest < Minitest::Test
  def setup
    @base = Dir.mktmpdir('pagy-cal-use')
    @gem_dir = File.join(@base, 'i18n-data')
    @locale_dir = File.join(@gem_dir, 'rails', 'locale')
    FileUtils.mkdir_p(@locale_dir)
    @old_load_path = ::I18n.load_path.dup
    @old_spec = Gem.loaded_specs['rails-i18n']
    ::I18n.load_path = []
    Gem.loaded_specs['rails-i18n'] = Struct.new(:full_gem_path).new(@gem_dir)
  end

  def teardown
    Gem.loaded_specs['rails-i18n'] = @old_spec
    ::I18n.load_path = @old_load_path
    FileUtils.rm_rf(@base)
  end

  def test_valid_calendar_locales_are_registered
    Pagy::Calendar.localize_with_rails_i18n_gem('en', 'pt-BR')
    registered = ::I18n.load_path.map(&:to_s)
    assert(registered.any? { |path| path.end_with?('rails/locale/en.yml') },
           'the en calendar locale was not registered')
    assert(registered.any? { |path| path.end_with?('rails/locale/pt-BR.yml') },
           'the pt-BR calendar locale was not registered')
  end

  def test_hyphenated_calendar_locale_is_registered
    Pagy::Calendar.localize_with_rails_i18n_gem('zh-Hant-CN')
    assert(::I18n.load_path.map(&:to_s).any? { |path| path.end_with?('rails/locale/zh-Hant-CN.yml') },
           'a well-formed hyphenated calendar locale was not registered')
  end
end
