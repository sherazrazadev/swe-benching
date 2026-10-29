# A project member can grant project access to a group without the membership permission

## The system

This project is the control plane of a Kubernetes-based platform. Teams share a *project*: it owns
a namespace, and the people and groups recorded as the project's members receive Kubernetes access
to that namespace and to the project itself. A project records a member list and an owner, and the
platform's controllers turn that recorded data into the cluster's access rules. Membership is meant
to be governed by a dedicated permission on the project, `manage-members`. Managing service accounts
is deliberately outside that flow, because automation owns them.

## Observed impact

A member of a project who may update the project, but who has not been granted its `manage-members`
permission, updates the project to add a group to its member list. The request is accepted and the
group is granted the project's access, so every user in that group receives the project's
permissions. For example, the member sends a normal project update whose only meaningful change is a
member entry naming a group with the `admin` role; the platform returns success, and the group gains
administrative access to the project.

## Security property

No one may give a user or a group access to a project, or change the access a member already has,
unless the change is authorized for that project's `manage-members` permission. The property holds
however the access is granted, wherever it is recorded, and in every state a project can be in. It
is not waived by the shape of the request or by what the request otherwise contains.

Service accounts are the only subjects whose project access may change under ordinary project update
permission. A subject is a service account only when it is of kind `ServiceAccount`, or when it is a
user whose name has the form `system:serviceaccount:<namespace>:<name>`. A group is never a service
account, whatever its name looks like.

The example above is one instance of the property, not the full set.

## Contracts the fix must honour

- **Refusal form.** A change that would violate the property must fail with a client error and must
  not take effect: no member, owner or access binding may be written. No particular status code or
  message is required.
- **Authorized changes still apply.** When the required permission is present, adding, removing and
  re-roling users and groups must behave exactly as it does today.

## Keep working exactly as today

- Service-account subjects — of kind `ServiceAccount`, and users named
  `system:serviceaccount:<namespace>:<name>` — can be added, removed and re-roled with ordinary
  update permission.
- The project's owner can transfer ownership and change the member list without the `manage-members`
  permission.
- Creating a project works as today, including when the create request does not name an owner: the
  creator becomes the owner and may list members.
- Updates that change nothing about user or group access still succeed.
- Existing projects keep the access they have, and ordinary updates keep producing exactly the access
  they produce today.
- Everything else in the project's existing behaviour for the affected area.

## Constraints

- Fix the problem and its close variants, not only the example.
- Keep every legitimate use working.
- Do not look up the upstream fix.
- There is no network access.
- Do not special-case the example.
