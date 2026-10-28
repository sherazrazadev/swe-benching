# frozen_string_literal: true

require_relative '../support/pagy_test_helper'

# Locale names must never locate a dictionary file outside the configured directories.
# Markers are harmless strings; no file outside the temporary tree is touched.
class LocaleReadSecurityTest < Minitest::Test
  MARKER = 'PAGY-SEC-MARKER-7F3A'

  def setup
    @base = Dir.mktmpdir('pagy-sec')
    @dict = File.join(@base, 'app', 'locales')
    FileUtils.mkdir_p(@dict)
    @old_pathnames = Pagy::I18n.pathnames.dup
    Pagy::I18n.instance_variable_set(:@pathnames, @old_pathnames + [Pathname.new(@dict)])
    Pagy::I18n.locales.clear
    Thread.current[:pagy_locale] = nil
  end

  def teardown
    Pagy::I18n.instance_variable_set(:@pathnames, @old_pathnames)
    Pagy::I18n.locales.clear
    Thread.current[:pagy_locale] = nil
    FileUtils.rm_rf(@base)
  end

  # Place a dictionary whose top-level locale key is exactly `locale`, at the path the
  # library would resolve for it relative to the configured dictionary directory.
  def plant_dictionary(locale)
    path = File.join(@dict, "#{locale}.yml")
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, { locale => { 'pagy' => { 'p11n' => 'OneOther',
                                               'item_name' => { 'one' => MARKER,
                                                                'other' => MARKER } } } }.to_yaml)
    path
  end

  def guarded
    yield
  rescue ArgumentError
    :refused
  end

  def refute_marker(value, message)
    refute_includes value.to_s, MARKER, message
  end

  # T1: the public per-request language selection.
  def test_selection_with_a_parent_reference_cannot_load_outside_the_dictionaries
    plant_dictionary('../outside-a')
    result = guarded { Pagy::I18n.locale = '../outside-a'; Pagy::I18n.translate('pagy.item_name', count: 1) }
    refute_marker(result, 'a selected language loaded a dictionary from outside the configured directory')
  end

  # T1 shape: a valid-looking language prefix followed by a path traversal.
  def test_selection_with_a_valid_prefix_and_a_separator_cannot_load_outside_the_dictionaries
    plant_dictionary('pt-BR/../../outside-b')
    result = guarded { Pagy::I18n.locale = 'pt-BR/../../outside-b'; Pagy::I18n.translate('pagy.item_name', count: 1) }
    refute_marker(result, 'a language name with a valid prefix escaped the configured directory')
  end

  # T1 shape: a deeper parent reference.
  def test_selection_with_a_deep_parent_reference_cannot_load_outside_the_dictionaries
    plant_dictionary('../../outside-c')
    result = guarded { Pagy::I18n.locale = '../../outside-c'; Pagy::I18n.translate('pagy.item_name', count: 1) }
    refute_marker(result, 'a deep parent reference escaped the configured directory')
  end

  # T2: the per-request storage written directly, bypassing the public selection API.
  def test_storage_written_directly_cannot_load_outside_the_dictionaries
    plant_dictionary('../../outside-d')
    result = guarded do
      Thread.current[:pagy_locale] = '../../outside-d'
      Pagy::I18n.translate('pagy.item_name', count: 1)
    end
    refute_marker(result, 'a directly stored language value loaded a dictionary from outside the configured directory')
  end

  # T3 (injected): the dictionary inspection helper repeats the locale-to-path lookup.
  def test_dictionary_inspection_cannot_read_outside_the_dictionaries
    plant_dictionary('../outside-e')
    result = guarded { Pagy::I18n.dictionary_for('../outside-e') }
    refute_marker(result.inspect, 'the dictionary inspection helper read a file outside the configured directory')
  end
end
