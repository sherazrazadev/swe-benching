# A forged payment notification can add money to an account's wallet

AVideo is a video platform where viewers keep a site wallet and use it to pay for content and
subscriptions. One of its payment integrations works with Authorize.Net: when a card payment
happens the provider notifies the site, and the site adds the payment to the buyer's wallet.

We found that a single HTTP request to the site's payment-notification endpoint, carrying the
reference of a real transaction together with a different account and a much larger amount, added
that larger amount to the wallet of the account named in the request. The provider had never
reported that payment for that account.

## Security invariant

Any wallet credit this payment integration records must be for a payment the provider confirms,
with the account and amount the provider reports for that payment. No value supplied in a request
may decide which account, amount or currency is credited, and a notification that fails the
authentication the integration checks must not credit anything.

## Refusal

A request whose values cannot be trusted must not change any wallet balance. Such a request is
refused with a client error and leaves no wallet change behind.

## What must keep working

Everything legitimate that works today keeps working exactly as it does today, except where it
conflicts with the invariant above. In particular:

- A notification that is correctly authenticated with the configured key still credits its payment.
- A payment the provider reports as settled is still credited; a payment the provider reports as
  not approved is not.
- The account and amount credited are the ones the provider holds for the transaction: a
  legitimate payment of 5.00 is credited as 5.00, to the paying account.
- Every legitimate notification the integration accepts today is still accepted.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example.
