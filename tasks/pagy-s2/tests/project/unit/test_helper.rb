# frozen_string_literal: true

# Minimal harness for the project's own locale-file test. The task's functional runner has
# already put the product's gem/lib on the load path; the full project harness pulls in
# database playground gems unrelated to this area.
require 'pagy'
require 'minitest/autorun'
require 'minitest/spec'
