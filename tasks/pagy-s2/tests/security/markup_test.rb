# frozen_string_literal: true

require_relative '../support/pagy_test_helper'
require 'pagy/classes/request'

# Values supplied as display options must not end the attribute or element they are
# placed in. The payloads only introduce a harmless marker attribute / script text.
class MarkupSecurityTest < Minitest::Test
  ATTRIBUTE_PAYLOAD = '1" data-pwn="pwned'
  ELEMENT_PAYLOAD   = '1"></script><script>alert(1)</script>'

  def pagy
    request = Pagy::Request.new({ request: { base_url: 'http://example.com',
                                             path: '/items',
                                             params: {} } })
    Pagy::Offset.new(count: 100, limit: 10, max_limit: 50, request: request)
  end

  def guarded
    yield
  rescue ArgumentError
    ''
  end

  def refute_attribute_breakout(html, message)
    refute_includes html.to_s, 'data-pwn="pwned"', message
  end

  # T5: the developer display helper.
  def test_display_scale_cannot_add_a_script_element
    html = guarded { Pagy.dev_tools(wand_scale: ELEMENT_PAYLOAD) }
    refute_includes html.to_s, '<script>alert(1)</script>',
                    'a display scale value ended the attribute and added a script element'
  end

  # T6: accessible label on the navigation element.
  def test_navigation_accessible_label_cannot_add_an_attribute
    html = guarded { pagy.series_nav(aria_label: ATTRIBUTE_PAYLOAD) }
    refute_attribute_breakout(html, 'a navigation accessible label ended its attribute')
  end

  # T6: accessible label on a disabled link.
  def test_disabled_link_accessible_label_cannot_add_an_attribute
    html = guarded { pagy.previous_tag(aria_label: ATTRIBUTE_PAYLOAD) }
    refute_attribute_breakout(html, 'a link accessible label ended its attribute')
  end

  # T7: navigation element id.
  def test_navigation_id_cannot_add_an_attribute
    html = guarded { pagy.series_nav(id: ATTRIBUTE_PAYLOAD) }
    refute_attribute_breakout(html, 'a navigation id ended its attribute')
  end

  # T7: info element id.
  def test_info_id_cannot_add_an_attribute
    html = guarded { pagy.info_tag(id: ATTRIBUTE_PAYLOAD) }
    refute_attribute_breakout(html, 'an info id ended its attribute')
  end

  # T8 (injected): a presentation tooltip option on the info helper.
  def test_info_tooltip_cannot_add_an_attribute
    html = guarded { pagy.info_tag(title: ATTRIBUTE_PAYLOAD) }
    refute_attribute_breakout(html, 'a tooltip value ended its attribute')
  end
end
