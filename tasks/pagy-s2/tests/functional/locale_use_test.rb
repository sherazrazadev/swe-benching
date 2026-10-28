# frozen_string_literal: true

require_relative '../support/pagy_test_helper'

# Legitimate language selection keeps working exactly as today.
class LocaleUseFunctionalTest < Minitest::Test
  def setup
    @old_pathnames = Pagy::I18n.pathnames.dup
    Pagy::I18n.locales.clear
    Thread.current[:pagy_locale] = nil
  end

  def teardown
    Pagy::I18n.instance_variable_set(:@pathnames, @old_pathnames)
    Pagy::I18n.locales.clear
    Thread.current[:pagy_locale] = nil
  end

  def test_region_specific_dictionary_still_resolves
    Pagy::I18n.locale = 'pt-BR'
    assert_equal 'itens', Pagy::I18n.translate('pagy.item_name', count: 2)
  end

  def test_second_region_specific_dictionary_still_resolves
    Pagy::I18n.locale = 'sv-SE'
    assert_equal 'resultat', Pagy::I18n.translate('pagy.item_name', count: 2)
  end

  def test_symbol_language_values_still_work
    Pagy::I18n.locale = :es
    assert_equal 'ítems', Pagy::I18n.translate('pagy.item_name', count: 2)
  end

  def test_nil_still_gives_default_language_output
    Pagy::I18n.locale = 'pt-BR'
    Pagy::I18n.locale = nil
    assert_equal 'items', Pagy::I18n.translate('pagy.item_name', count: 2)
  end

  def test_well_formed_unknown_language_is_kept_and_falls_back
    Pagy::I18n.locale = 'zh-Hant-CN'
    assert_equal 'zh-Hant-CN', Pagy::I18n.locale
    _out, _err = capture_io do
      assert_equal 'items', Pagy::I18n.translate('pagy.item_name', count: 2)
    end
  end
end
