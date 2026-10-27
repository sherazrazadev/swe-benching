# A namespaced policy can surface data from outside its namespace

Kyverno is a Kubernetes policy engine. Policies declare external data that Kyverno fetches while a
policy is evaluated, and Kyverno fetches that data with its own cluster-wide identity rather than
with the identity of the person who created the policy.

A user who may create a policy in one namespace can write a rule whose declared data is fetched
from somewhere else, and the fetched value is bound into the rule's context and appears in the
policy results. For example, a policy created in one namespace can be written so that it reads a
Secret that lives in another namespace, and the result exposes that Secret's contents to users who
have no access to that namespace.

## Requirement

A policy that belongs to a namespace must not make data from outside that namespace, or
cluster-scoped data, available to its evaluation, however the data is declared.

A cluster-scoped policy keeps its current unrestricted access.

A refusal is a client error and leaves the policy context unchanged.

This is an invariant, not a list of cases. The example above is an example.

## Behaviour that must not change

Everything that works today keeps working, including a policy's access to the data in its own
namespace and the existing behaviour for cluster-scoped policies.

## Constraints

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix. Do not special-case the example above.
