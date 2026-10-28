# Unlisted visitors can read the machine report

phpSysInfo is a web page that shows an operator the state of the machine it runs on: hardware,
memory, disks, network, the operating system and the software running on it. An operator can
restrict the installation to clients they name, and everyone else is supposed to see nothing.

An operator restricted an installation to one workstation address. A visitor from an unrelated
network opened the machine report and received the full hardware and operating-system details;
the only unusual thing about the request was an `X-Forwarded-For` header that named the
operator's workstation.

The rule we need is this: anything a response reveals about the machine the installation runs on
— its hardware, its operating system, the software installed on it or its runtime configuration
— must reach only a client whose real network origin the operator has admitted. A request must
never become admitted because of anything its sender supplies. The origin is the address of the
connection, or, when the operator has designated a reverse proxy as trusted, the client address
that proxy reports for the connection it accepted. If the origin cannot be established as
admitted, the request is refused and none of that information is returned.

## Configuration

The installation is configured through the product's main configuration file. The allow list is
the `ALLOWED` setting: a comma-separated list of IPv4 addresses and CIDR ranges; `false` means
no restriction. Where the installation sits behind a reverse proxy, the operator lists the
proxy's own addresses in the `TRUSTED_PROXIES` setting (also single addresses and CIDR ranges;
`false` or absent means no trusted proxy). Only a connection whose peer address is one of the
listed proxies may use the client address that proxy reports; for every other connection the
peer address is the client.

## Contracts

- A refused request is answered with an HTTP client error (a 4xx status) or the product's
  ordinary refusal message, and it never carries any of the protected information.
- An allow-list entry may be a single address or a range. A client address written in the
  IPv4-mapped IPv6 form is the same address as its IPv4 form.
- For a client whose own origin the allow list admits, everything that works today keeps
  working: such a client still receives everything it receives today, including through a
  reverse proxy the operator has designated as trusted.
- The example above is one trigger, not the full set of ways this can happen.

## Constraints

- Fix the problem and its close variants; do not change unrelated behaviour.
- Keep legitimate use working exactly as it does today.
- Do not look up or copy the upstream fix.
- Do not special-case the example; apply the rule generally.
