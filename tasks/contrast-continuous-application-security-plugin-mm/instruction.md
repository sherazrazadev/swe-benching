# Job configuration lookups expose the controller-wide Contrast settings to ordinary users

## What the system is

This plugin connects Jenkins jobs to a Contrast TeamServer. An administrator registers named
connection profiles — server address, organisation and credentials — on the controller-wide
configuration page. Each job then picks a profile, an application inside that profile, and the
vulnerability rules that matter to it. While a configuration form is open, the page asks the
controller in the background for the choices to display.

## Observed impact

A user who is signed in but may only read Jenkins — no permission to configure any job, and not an
administrator — could call the background form request that a job's configuration page uses and
receive the names of the global Contrast connection profiles. With a profile name, the same user
could then read that profile's application identifiers and vulnerability rule titles. Some of those
requests also made the controller contact the configured TeamServer with the stored credentials, and
one of them rewrote the stored profile data.

For example, an authenticated user with only overall read access can request a job's configuration
form choices and receive the profile list back, although that user cannot configure the job.

## What must hold

- A request that fills a choice list or validates a value may return connection-profile names,
  application identifiers or titles, vulnerability rule names or titles, or connection details only
  when the requesting user may configure the item that request belongs to.
- When a request is not attached to an item — the controller-wide configuration — that data may be
  returned only to a Jenkins administrator.
- For anyone else the request must return no entries and no such data (an empty choice list or a
  client error are both acceptable refusals), and it must not cause the plugin to contact the
  TeamServer, must not be used to decide whether a named application exists, and must not change
  the stored profile configuration.
- Choices that do not come from a connection profile — agent types and severity levels — stay
  available to any signed-in user, exactly as they are today.
- Users who may configure the item, including users whose configure permission is granted only for
  that job, keep receiving populated choices, and administrators keep receiving them on the
  controller-wide configuration page. Everything works exactly as it does today for them.

## Contracts

- A refusal is an empty choice list or a client error (4xx); a server error is not a refusal.
- The persisted profile configuration is not rewritten by a request that is refused.
- The plugin pages and their background requests keep working for every user who could use them
  before.
- These requirements apply wherever the plugin offers this data, not only to the example above.

There is no network access.

## Constraints

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream fix
or any existing implementation. Do not special-case the example.
