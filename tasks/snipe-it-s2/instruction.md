# A user editor can lock an administrator out of the instance

Snipe-IT is a self-hosted asset and licence management application. Access is
controlled by granular permissions: staff can be allowed to edit user records
without being allowed to change the settings that govern how an account
authenticates. Those settings are whether the account may sign in at all, and
whether the product or an external directory is responsible for its password.

Observed impact: a staff member who is allowed to edit user records, but who has
no authority over the sign-in and password-management settings of an
administrator's account, can open the bulk user-edit screen, select that
administrator together with ordinary users, and submit a change that disables
sign-in and marks the password as directory-managed. The administrator is locked
out of the instance, while the same submission changes the ordinary users as
requested.

Required invariant: no operation may change another account's authentication
settings — whether it can sign in, and whether its password is managed outside
the product — unless the caller holds authority over authentication settings for
that specific account, decided from the account being changed and not from the
request, the caller, a class, or a neighbouring account. This holds for every way
such a change can be submitted and for every value shape, including a value that
disables or clears a setting. An unauthorised change must not happen: the request
may be refused with a client error, or may complete while leaving the protected
settings untouched, but it must never produce a server error and must never
leave a partial change behind.

A second, different protection: an account must not be destroyed — deleted, or
folded into another account — unless the caller holds both the authority to
delete accounts and authority over authentication settings on the account being
removed, decided per account. The same refusal rules apply.

Everything that works today must keep working exactly as today. In particular, an
edit to the ordinary profile fields of a protected account (its city, display
name, department or start date, for example) must still be applied when it
travels in the same request as an authentication-setting change; group
membership changes must still be applied wherever the caller may administer the
account; and a value that disables or clears a setting must still take effect on
accounts the caller may administer. The values in this report are examples, not
a complete list of the protection or of the legitimate behaviour.

There is no network access. Fix the problem and its close variants without
special-casing the example above; do not look up the upstream fix or an existing
implementation.
