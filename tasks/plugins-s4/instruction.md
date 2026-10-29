# Privileged containers go unreported when they sit outside a pod's main container list

The Kubernetes-audit plugin converts Kubernetes audit records into fields that Falco's shipped
Kubernetes-audit rule set evaluates; the rule set is what raises an alert when a pod that is about
to run a privileged container is admitted. A pod can declare containers in more than one way, and
the shipped detection currently looks only at the main container list.

A user can create a Pod whose privileged container is an init container rather than a regular
one. The Pod is admitted and no privileged-container alert is raised, even though the Pod will run
that container with privileged mode.

## What must hold

For every per-container security setting that the shipped rule set reports, the setting must be
seen for every container the request would run: a value carried by any container must be reported,
wherever that container is declared. The existing trusted-image allowance remains the only
exception.

## Contracts

- The plugin's exported field catalogue must offer the same per-container values for every
  container list a request can carry, under its existing per-container naming with the container
  list's own key in place of the regular list's key. A value available for a regular container must
  be available for the same container in every list, and must return the values that container
  actually declares. A list that cannot carry a given value must not advertise it.
- Values that are published today keep their exact meaning, scope, ordering and index alignment.
  A value described as applying to regular containers keeps applying only to them, and the
  deprecated per-pod summaries keep summarising the same list they summarise today.
- A request that must be reported makes the shipped rule set fire. A request that must not be
  reported — a non-privileged container, or a trusted image under the allowance above — must not
  make a rule fire that the otherwise-identical request does not.
- These requirements cover the whole shipped detection, not only the example above.

There is no network access.

## Constraints

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix or any existing implementation. Do not special-case the example.
