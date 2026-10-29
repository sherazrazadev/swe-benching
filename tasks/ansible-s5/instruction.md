# ansible-galaxy runs a command named by requirement data

## System

Ansible is an automation tool. Its `ansible-galaxy` command installs roles and collections.
An operator names the items to install directly on the command line, lists them in a requirements
file, or relies on dependencies that an installed role declares in its own metadata. When an item
comes from a repository, the command hands the item to the version-control program named by the
requirement, then unpacks and installs the result.

## Observed impact

An operator installed a role from a requirements file supplied by a third party:

```
ansible-galaxy role install -r requirements.yml
```

One field of an entry began with a dash. The version-control program read that value as one of its
own options instead of as the repository or destination it was meant to be, and a command encoded
in the value ran on the operator's machine with the operator's privileges, before the installation
failed.

## Security property

Every value that a requirement supplies is data for the version-control program, however the
requirement reaches the command. No such value may be interpreted by that program as an option, a
configuration setting, or a command. If a requirement cannot be installed without giving one of its
values such a meaning, the installation must fail with an ordinary client error and must not create
or change anything outside the temporary install area.

## Contracts

- A refusal is a normal non-zero outcome of the command, with no side effect: the command named in
  the value never runs, and nothing outside the temporary install area is created or changed.
- Everything that works today keeps working exactly as today, including when the operator asks the
  version-control program to skip certificate verification: that request must remain in effect
  for the program rather than becoming an ordinary value.
- A normal role or collection name may contain dashes and dots and must still install, and a
  normal repository location may contain dots, dashes, colons and slashes.

The requirements file above is one instance, not the full set of ways the property can be violated.

## Constraints

- Fix the flaw and its close variants, not just the entry shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
