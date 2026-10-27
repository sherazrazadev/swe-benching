import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import gwhelper  # noqa: E402,F401  (sets the throwaway tracking store before product import)
