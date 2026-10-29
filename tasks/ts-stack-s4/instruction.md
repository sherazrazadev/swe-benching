# The wallet signs extra recipients the caller never asked to pay

## System

This is a TypeScript wallet library for a Bitcoin-style ledger. An application
asks the wallet to create an action: it names the outputs it wants to pay (each
with a locking script and an amount) and, optionally, the coins to spend. The
wallet asks its configured storage provider to assemble the unsigned
transaction, then signs it and sends it on. The storage provider may be remote,
and it is not trusted to decide who gets paid.

## Observed impact

An application creates an action paying one recipient:

```ts
await wallet.createAction({
  description: 'pay the invoice',
  outputs: [
    { lockingScript: invoiceScript, satoshis: 1000, outputDescription: 'invoice payment' }
  ]
})
```

The transaction that comes back and is broadcast carries a second output
paying 5000 satoshis to a different script, which the application never
requested. That recipient arrived with the storage provider's response while
the application's own screen showed only the invoice.

## Security property that must hold

No output may appear in a transaction this library signs, or in a transaction
it prepares for signing, unless it is exactly an output the caller requested
(same locking script, same amount), or the caller's own change, or at most one
service charge that is small relative to the action. This holds whatever the
storage response contains and however it presents it. In particular, no data
supplied with the storage response may decide a recipient the caller did not
choose.

## Contracts the fix must honor

- **Refusal form.** When the rule is violated the call fails with an ordinary
  client error, and no transaction is processed, signed for broadcast, or
  returned for signing.
- **Legitimate use is preserved exactly.** An action whose requested outputs
  come back unchanged is signed and processed exactly as it is today, including
  the caller's own change output whatever its amount, and a single service
  charge of the size storage providers normally charge.
- **Legitimate versus attack magnitude.** A service charge on the order of ten
  thousand satoshis is legitimate. A charge a hundred thousand times that, or
  any charge that is a meaningful share of the value being spent, is not.
- **Generality.** The example above is one instance, not the full set of ways
  the property can be violated.

Fix the problem so the property holds generally. Keep legitimate use working.
Do not look up or copy an upstream fix for this issue. Do not special-case the
example.
