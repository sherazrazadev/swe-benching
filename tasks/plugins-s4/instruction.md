# A per-container security setting can go unreported

The Kubernetes-audit plugin converts Kubernetes audit records into fields that Falco's shipped
Kubernetes-audit rule set evaluates; the rule set is what raises an alert when a pod that is about
to run a container with an unsafe setting is admitted. A per-container security setting can go
unreported when the detection does not inspect the container that carries it.

A Pod is admitted and no alert is raised, even though the Pod will run that container with the
setting the rule set exists to report.

## What must hold

For every per-container security setting that the shipped rule set reports, the setting must be
seen for every container the request would run: a value carried by any container must be reported,
wherever that container is declared. Existing exemptions keep their current effect.

## Contracts

- The plugin's exported field catalogue must offer the same per-container values for every
  container list a request can carry, under its existing per-container naming with the container
  list's own key in place of the regular list's key. A value available for a regular container must
  be available for the same container in every list, and must return the values that container
  actually declares. A list that cannot carry a given value must not advertise it.
- Existing published values keep their documented meaning, scope, ordering and index alignment.
- A request that must be reported makes the shipped rule set fire. A request that must not be
  reported — one that carries no such setting, or one an existing exemption covers — must not make
  a rule fire that the otherwise-identical request does not.
- These requirements cover the whole shipped detection.

There is no network access.

## Constraints

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix or any existing implementation. Do not special-case the reported case.
