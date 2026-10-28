# frozen_string_literal: true

require_relative '../support/pagy_test_helper'
require 'pagy/classes/request'

# Legitimate display values still render exactly as today.
class MarkupUseFunctionalTest < Minitest::Test
  def pagy
    request = Pagy::Request.new({ request: { base_url: 'http://example.com',
                                             path: '/items',
                                             params: {} } })
    Pagy::Offset.new(count: 100, limit: 10, max_limit: 50, request: request)
  end

  def test_development_helper_keeps_numeric_scales
    default_html = Pagy.dev_tools
    assert_match(/data-scale="[0-9.]+"/, default_html)
    assert_equal 1.0, default_html[/data-scale="([^"]*)"/, 1].to_f

    fractional_html = Pagy.dev_tools(wand_scale: 2.5)
    assert_match(/data-scale="[0-9.]+"/, fractional_html)
    assert_equal 2.5, fractional_html[/data-scale="([^"]*)"/, 1].to_f
  end

  def test_navigation_label_and_id_still_render
    html = pagy.series_nav(aria_label: 'My pages', id: 'my-nav')
    assert_includes html, 'aria-label="My pages"'
    assert_includes html, 'id="my-nav"'
  end

  def test_info_id_and_tooltip_still_render
    html = pagy.info_tag(id: 'info', title: 'Totals')
    assert_includes html, 'id="info"'
    assert_includes html, 'title="Totals"'
  end

  def test_disabled_link_label_still_renders
    html = pagy.previous_tag(aria_label: 'Go back')
    assert_includes html, 'aria-label="Go back"'
  end

  def test_info_without_options_still_renders
    html = pagy.info_tag
    assert_includes html, 'class="pagy info"'
    refute_includes html, 'title='
  end
end
