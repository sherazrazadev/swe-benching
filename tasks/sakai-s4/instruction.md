# Another person's profile can be changed by naming their account

Sakai is a collaboration and learning environment used by schools and universities. Every account has a profile. A profile holds the details a person fills in about themselves - a nickname, pronouns, the phonetic spelling of their name, a mobile number and links to social profiles - together with the person's picture, a recording of how their name is pronounced, and a setting that controls whether the profile is locked.

## Observed impact

A signed-in user changed another person's profile by sending a profile change request that named that other person's account. In the reported case, a request that removed a profile picture for an account other than the caller's own removed that person's picture, and the caller received a success response. The same request aimed at the caller's own account worked normally.

## Required invariant

Only the person the profile belongs to, or an administrator acting on that person's behalf, may change or remove any part of it.

No request and no caller-supplied value may cause any part of a profile to be changed or removed for anyone else. This covers every part of a profile described above, every value in a request that identifies the profile it acts on, every form that value can take, and every way a profile change is applied in the product.

A refused change must fail. A caller that receives a response gets a client error; any other caller gets an exception. In both cases nothing about the target profile is changed or removed, and a request with no authenticated user is refused in the same way.

## Must keep working

- A person keeps changing their own profile: its details, picture, pronunciation recording and lock setting.
- Administrators keep changing other people's profiles exactly as they can today.
- Profile information stays readable: other people's pictures and pronunciation recordings remain visible to everyone who can see them today.

Everything that works today must keep working exactly as today.

## Notes

The example above is an example, not the full set. Fix the problem and its close variants; do not special-case the example. Do not look up the upstream fix. Keep the change confined to this repository.

The project's dependencies are already available locally; build it with Maven's offline mode.
