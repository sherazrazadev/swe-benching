# Token royalties can create tokens

Klever Go is the node software for the Klever network. Accounts submit signed transactions and the
node executes them against on-chain state. A token can carry a royalty configuration: a main royalty
receiver plus a set of split recipients, each with a share of the royalty. That stored configuration
is used whenever a royalty is settled.

## What we observed

A token was created with two split recipients whose shares were set to very large values, each well
above 100% of a royalty, and the creation was accepted. When the owner then transferred 800 units of
that token, the transfer owed a 40-unit royalty, and one split recipient was credited 80 units —
twice the royalty — although only 40 units of royalty existed. Units appeared from nothing, and
every further payout repeats the effect.

## What must hold

Invariant: whenever a royalty is settled, the total credited to royalty recipients must equal the
amount taken from the payer for that royalty, and the payer must be debited exactly the royalty
amount owed — never more and never less. A share, or a combination of shares, that would pay
recipients more than the royalty that funds the payout is invalid: it must be refused when it is
submitted, and it must never be applied when configuration saved earlier is used to settle a later
payout.

The invariant holds for every flow in which the node settles a royalty, not only for the flow in the
example.

## Contracts

- A refused submission returns a client error from the transaction-processing interface and has no
  effect: no balance changes and no stored configuration changes.
- Legitimate use keeps working exactly as it does today. A configuration whose shares stay within
  the royalty is accepted, and a configuration that assigns the entire royalty to a single split
  recipient is legitimate and must settle.
- Assets with no royalty, or with no split recipients, are unaffected.
- The public transaction and contract interfaces are unchanged.

## Constraints

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix. Do not special-case the example. Do not weaken the protection to accommodate code that relies
on the previous behaviour.

Ordinary magnitudes: an 800-unit transfer owing a 40-unit royalty, and shares of 50% or 30%, are
normal. Shares may not exceed 100%, and combined shares may not exceed 100% of the royalty.
