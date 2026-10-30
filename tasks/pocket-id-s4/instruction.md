# Problem report: authorization requests can be bounced to an arbitrary site

Pocket ID is a self-hosted identity provider. When a web application (an OIDC client) wants a user to sign in, it sends the browser to Pocket ID's authorization screen together with the address the application has registered to receive the user back. Once Pocket ID is done — the user signed in, already had a session, or was refused — the browser is sent back to that address with the result: an authorization code, or an error such as `login_required`.

We found that a crafted link makes Pocket ID send visitors to a site of the attacker's choosing. The link asks Pocket ID to complete silently (`prompt=none`) and supplies a redirect address that the application never registered. Pocket ID refuses with `login_required`, but still sends the browser to the supplied address with the error appended:

    /authorize?client_id=<id>&redirect_uri=https://refused.invalid/collect&response_type=code&scope=openid&prompt=none

The visitor lands on `https://refused.invalid/collect?error=login_required`, so Pocket ID can be used as a trusted-looking bounce to any site.

**Required behaviour.** Pocket ID must never send a user's browser to a redirect address that the requesting application has not already registered. If the address in the request is not one of that application's registered addresses — including when the application has registered none — the request must stop on the authorization screen with a visible error, the browser must not leave Pocket ID, and nothing may be registered or changed as a side effect. This holds however the request is formed and for every way an authorization request can complete or be refused.

**Contracts.**

- A refusal is shown on the authorization screen. The browser stays on Pocket ID, and no request reaches the refused address.
- A registered address is trusted. Requests that match one of the application's registered addresses must keep being sent there with their result, exactly as they are today. Registered addresses may be patterns (for example, a host or path containing wildcards), and a native application may register a loopback address that it uses on any port; those must keep matching.
- When an authorization request carries its parameters in a pushed authorization request rather than in the URL, the address it carries is the one that applies.
- Everything else that works today keeps working, including signing in, completing an authorization, and the existing response modes.

The example above is one instance, not the full set. Fix the problem and its close variants; keep legitimate use working; do not special-case the example.
