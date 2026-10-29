# Instantiating a config can still obtain a callable the library refuses

## System

Hydra is a Python configuration framework. An application builds a configuration and calls the
framework's instantiation API (`hydra.utils.instantiate`, also exposed as `hydra.utils.call`) to
turn a config entry into an object: the entry names a callable through `_target_` and supplies its
arguments. Configs are often loaded from files supplied by other parties, so the framework refuses
some dangerous targets by default, and lets trusted callers pass `_target_whitelist_` to state
which targets a call may use.

## Observed impact

An application instantiated a config it had received from an outside party. The config did not
name a refused target as its `_target_`; it asked the framework's public dotpath lookup to fetch
one:

```yaml
handler:
  _target_: hydra.utils.get_object
  _args_: ["os.system"]
```

The call returned the shell-command callable and reported nothing unusual. The framework refuses
`os.system` when it is the target of the entry, but the application's later use of the returned
value ran code chosen by the config's author with the application's privileges.

## Security property

No value supplied by a config may make instantiation resolve, call, return or defer a callable
that the active target policy refuses — on the default policy and when an allowlist is supplied,
and for every shape of value the library accepts.

## Contracts the fix must honor

- **Refusal.** A config that would lead to a refused callable must not produce or return it. The
  call either raises an ordinary Python exception before any effect, leaving the filesystem
  unchanged, or returns a deferred value that raises when used instead of yielding the refused
  callable. It must not end the process, and it must not substitute a placeholder.
- **Preservation.** Everything that works today keeps working: allowed targets instantiate;
  `_partial_: true` on an allowed target still returns a deferred callable; data values, and
  callables the policy does not refuse, keep flowing through unchanged; the explicit opt-out that
  disables target checks keeps working.
- **Allowlists.** An allowlist entry that names a target exactly keeps authorizing that target,
  even when the object it resolves to has a different canonical name; wildcard entries keep
  matching the package prefixes they match today. An allowlist never turns a refused callable into
  an allowed one merely because whatever selected it was allowed.

The example above is one instance, not the full set of ways the property can be violated.

## Constraints

- Fix the flaw and its close variants, not just the call shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
