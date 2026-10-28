# frozen_string_literal: true

require_relative '../support/pagy_test_helper'
require 'i18n'
require 'pagy/classes/calendar/calendar'

# A locale name accepted by the calendar localization setup must not register a locale
# file outside the directory that setup reads from. The marker is harmless.
class CalendarReadSecurityTest < Minitest::Test
  MARKER = 'PAGY-CAL-MARKER-91B'

  def setup
    @base = Dir.mktmpdir('pagy-cal')
    @gem_dir = File.join(@base, 'i18n-data')
    @locale_dir = File.join(@gem_dir, 'rails', 'locale')
    FileUtils.mkdir_p(@locale_dir)
    @old_load_path = ::I18n.load_path.dup
    @old_enforce = ::I18n.enforce_available_locales
    @old_spec = Gem.loaded_specs['rails-i18n']
    ::I18n.load_path = []
    ::I18n.enforce_available_locales = false
    ::I18n.backend = ::I18n::Backend::Simple.new
    Gem.loaded_specs['rails-i18n'] = Struct.new(:full_gem_path).new(@gem_dir)
  end

  def teardown
    Gem.loaded_specs['rails-i18n'] = @old_spec
    ::I18n.load_path = @old_load_path
    ::I18n.enforce_available_locales = @old_enforce
    ::I18n.backend = ::I18n::Backend::Simple.new
    FileUtils.rm_rf(@base)
  end

  def test_calendar_localization_cannot_load_a_file_outside_its_locale_directory
    marker_file = File.join(@base, 'outside-cal.yml')
    locale = Pathname.new(marker_file)
                     .relative_path_from(Pathname.new(@locale_dir))
                     .to_s.sub(/\.yml\z/, '')
    File.write(marker_file, { 'en' => { 'pagy_cal_marker' => MARKER } }.to_yaml)

    begin
      Pagy::Calendar.localize_with_rails_i18n_gem(locale)
    rescue ArgumentError
      # A deliberate refusal is a valid outcome.
    end

    begin
      ::I18n.backend.load_translations
    rescue StandardError
      # An unreadable load path must not turn into a silent success; the marker check decides.
    end

    refute_includes ::I18n.t('pagy_cal_marker').to_s, MARKER,
                    'calendar localization registered and loaded a file outside its locale directory'
  end
end
