# A cached result can come from a different image

## System

Streamlit lets a Python application mark a function as cached. When the
application calls the cached function again with the same arguments, Streamlit
serves the previously computed result instead of running the function again.
Applications use this for expensive image processing as well as for data work.

## Observed impact

An application caches an image-processing step:

```python
import streamlit as st

@st.cache_data
def corner_colour(image):
    return image.convert("RGB").getpixel((0, 0))
```

The function was called with two images that carry the same stored pixel data
but different colour tables, so the two images display different colours. The
second call returned the first image's colour, and the function never ran for
the second image.

## Security property

A cached function must never return a result that was computed from a different
image. Whenever two images render differently, the cache must treat them as
different inputs. This holds for every image a cached function receives,
whatever its size or content.

## Contracts the fix must honor

- **Cache semantics.** An equal input is still served from the cache: calling a
  cached function again with the same value must not run the function body
  again, whether or not that value is an image.
- **Stable cache identity.** The identity a cache gives an input must be the
  same in a later process, so a cache persisted to disk keeps working after a
  restart and does not silently recompute or lose entries.
- **Every public cache decorator.** Functions decorated through any of the
  public caching entry points keep working and follow the same rules.
- **Non-image values.** Integers, strings, arrays and tables keep their current
  keying behaviour: equal values still share an entry and different values
  still do not.
- **Legitimate large inputs.** Large inputs that render the same must keep
  sharing one entry; telling different images apart does not mean refusing or
  re-running large ones.

The example above is one instance, not the full set of ways the property can be
violated.

## Constraints

- Fix the problem and its close variants, not just the call shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
