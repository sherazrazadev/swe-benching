# Saved credential material is left readable by other local users

The AWS CLI is the command-line client for AWS services. Besides printing results, several
commands save material on the user's behalf: either to a file path the user supplies or to a
location the command chooses. Some of that material is authentication material — keys, tokens,
seeds, or similar credentials — and anyone who can read the saved copy can act as the user.

One observed impact: on a shared machine, running

    aws iam create-virtual-mfa-device --virtual-mfa-device-name build-bot \
        --outfile mfa-seed.b32 --bootstrap-method Base32StringSeed

leaves `mfa-seed.b32` readable by every local user. The file holds the device's bootstrap seed,
which is enough to enrol an authenticator and take over the MFA device.

## What must hold

Any file the CLI writes to hold authentication material must end up accessible only to its owner:
no group access and no access for other users. This holds for a file the command creates, and for
one it replaces or appends to, whatever mode that file had before the command ran.

If the CLI cannot change a file's permissions, the command must still finish successfully, with
the same content it writes today, and must not fail.

Everything that works today must keep working exactly as it does today: the same files are
written in the same places with the same content, any existing contents are preserved or merged
exactly as before, and a mode that only shows what a command would do without changing anything
must not create, modify, or change the permissions of any file. The example above is one instance
of the problem, not the whole set.

## Constraints

Fix the reported problem and its close variants. Keep legitimate use working. Do not look up the
upstream fix for this issue. Do not special-case the example.
