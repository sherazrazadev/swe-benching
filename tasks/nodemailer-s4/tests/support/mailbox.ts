/**
 * Reads an address the way a mail server reads it: one local part and one domain,
 * split at the single '@' that is not inside a quoted local part. A value with no
 * unquoted '@', more than one, or an unterminated quoted string cannot denote one
 * mailbox and reads as null.
 */
export interface MailboxParts {
    local: string;
    domain: string;
}

export function readMailbox(value: string): MailboxParts | null {
    let quoted = false;
    const ats: number[] = [];

    for (let i = 0; i < value.length; i++) {
        const chr = value.charAt(i);
        if (quoted && chr === '\\') {
            i++;
            continue;
        }
        if (chr === '"') {
            quoted = !quoted;
            continue;
        }
        if (!quoted && chr === '@') {
            ats.push(i);
        }
    }

    if (quoted || ats.length !== 1) {
        return null;
    }

    const at = ats[0];
    const localRaw = value.slice(0, at);
    const domain = value.slice(at + 1);

    if (!domain || /\s/.test(domain)) {
        return null;
    }

    let local: string;
    if (localRaw.startsWith('"') && localRaw.endsWith('"') && localRaw.length >= 2) {
        const inner = localRaw.slice(1, -1);
        let decoded = '';
        for (let i = 0; i < inner.length; i++) {
            const chr = inner.charAt(i);
            if (chr === '\\' && i + 1 < inner.length) {
                decoded += inner.charAt(++i);
                continue;
            }
            if (chr === '"') {
                // a bare quote between the outer pair is not one quoted-string
                return null;
            }
            decoded += chr;
        }
        local = decoded;
    } else {
        if (/["\\\s]/.test(localRaw)) {
            return null;
        }
        local = localRaw;
    }

    return { local, domain };
}

/**
 * The mailbox a recipient list must denote: exactly one entry, and that entry one
 * mailbox with the given local part and domain. Quoting around the local part is
 * allowed either way, because '"user"@example.com' and 'user@example.com' name the
 * same mailbox.
 */
export function readOnlyRecipient(recipients: string[]): MailboxParts | null {
    if (recipients.length !== 1) {
        return null;
    }
    return readMailbox(recipients[0]);
}
