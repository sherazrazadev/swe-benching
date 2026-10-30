# frozen_string_literal: true
# The project's top-level spec helper tries to activate Bundler. The verifier
# installs the gems the project's tests need system-wide instead of running
# `bundle install`, so make that one optional require behave as if Bundler were
# absent (the helper already rescues LoadError).
module Kernel
  alias_method :__yard_task_original_require, :require

  def require(name)
    raise LoadError, 'bundler is not used in this runner' if name == 'bundler/setup'

    __yard_task_original_require(name)
  end
end
