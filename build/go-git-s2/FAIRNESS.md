# Fairness and leniency review — go-git-s2

**P** — Security property: any accepted name must stay within the reference storage and affect only the reference it denotes and that reference's data; never another reference or other stored data, whatever it looks like, however it reaches the library, whichever code path acts; unconfined names are refused.
**C1** — "A refused name returns an error and has no effect."
**C2** — "Everything that works today keeps working exactly as today."

## 1. Per-test fairness

| test (file::name) | asserts | fair because | could a correct fix fail? | risk |
|---|---|---|---|---|
| sec_write::WriteDoesNotOverwriteConfig | SetReference("config"/"refs/../../config") errors; config intact | P + C1 | no — guard at SetRef, ReferenceStorage or setRef sees the raw name; any error counts | low |
| sec_write::WriteDoesNotCreateHook | "hooks/pre-commit" writes no hook | P | no | low |
| sec_write::WriteDoesNotAliasReflog | "logs/HEAD" refused; reflog intact | P | no | low |
| sec_write::WriteSecondImplementation | norwfs SetReference("refs/../../config") refused | P ("whichever code path") + expert knowledge: capability-selected writer | no — dispatcher and wrapper guards both cover it | low |
| sec_write::WriteSecondImplementationDoesNotAliasMetadata | norwfs "config" refused | P | no | low |
| sec_write::CheckAndSetDoesNotOverwriteConfig | CheckAndSetReference("config",nil) refused | P + C1 | no — SetRef guard covers both wrappers | low |
| sec_read::ReadDoesNotReturnMetadata | Reference("hooks/post-checkout") errors, nil ref | P + C1 | no — nil,err is the natural refusal at any layer | low |
| sec_read::ReadRejectsTraversalName | "refs/../../config" refused | P + C1 | no | low |
| sec_delete::DeleteDoesNotRemoveMetadata | RemoveReference("config"/"refs/../../packed-refs") refused | P + C1 | no | low |
| sec_reflog::ReflogAppendDoesNotWriteMetadata | AppendReflog("refs/../../config") refused | P + C1 | no — ReflogStorage or dotgit guard | low |
| sec_reflog::ReflogReadDoesNotReturnMetadata | Reflog("../hooks/post-checkout") errors, 0 entries | P + C1 | no | low |
| sec_reflog::ReflogDeleteDoesNotRemoveMetadata | DeleteReflog("../hooks/post-checkout") refused | P + C1 | no | low |
| sec_reflog::ReflogExpireDoesNotRewriteMetadata | ExpireReflog("../config"/"refs/../../config") refused | P + C1 | no | low |
| sec_tag::TagDoesNotReturnOtherReference | Tag("../heads/main") refused | P ("however it reaches the library" — path.Join rewrites it before storage) + C1 | no — a storage-only guard lets the rewritten name through, so it is incomplete, not correct | low |
| sec_tag::DeleteTagDoesNotDeleteBranch | DeleteTag("../heads/main") refused; branch intact | P + C1 | no | low |
| sec_tag::DeleteTagDoesNotRemoveMetadata | DeleteTag("../../config") refused | P + C1 | no | low |
| sec_tag::TagDoesNotReturnMetadata | Tag("../../config") errors, nil ref | P + C1 | no | low |
| sec_rename::RenameDoesNotMoveMetadata | RenameReference("config","refs/heads/leak") refused | P + C1 | no — wrapper or dotgit guard | low |
| sec_rename::RenameDoesNotMoveTraversalMetadata | traversal source refused; no leak file | P + C1 | no | low |
| sec_rename::RenameDoesNotOverwriteMetadata | destination "config"/traversal refused; source survives | P + C1 | no — validate both operands before mutating | low |
| func_reference::ReferenceRoundTrip | nested refs store/read/remove | C2 | no — containment accepts refs/... | low |
| func_reference::RootReferences | HEAD and ORIG_HEAD/FETCH_HEAD/MERGE_HEAD/"bar" accepted | C2 (current behaviour) | no — containment accepts them; a refs/-only validator rejects "bar" but breaks C2 and visible project tests | medium |
| func_reference::InvalidPlaceholderReference | refs/heads/.invalid round-trips; HEAD targets it | C2 — the library itself writes this placeholder | no — containment accepts it; a full check-ref-format validator is a different mechanism and breaks C2 | medium |
| func_tag::TagAPI | create/read/delete "v1","release/v2" | C2 | no | low |
| func_tag::PackRefsKeepsReferences | refs survive PackRefs | C2 | no | low |
| func_reflog::Reflogs | reflog append/read/delete for HEAD, refs/heads/main, "bar" | C2 | no — reflog rule is parent-path-only, as documented | low |
| func_maintenance::SecondWriteImplementation | norwfs round-trip | C2 | no | low |
| func_maintenance::RenameReference | rename old→topic/new, source freed | C2 | no | low |
| func_maintenance::ExpireReflog | keeps recent, drops old, missing reflog not an error | C2 (code comment) | no | low |
| project.xml::dotgit/filesystem/plumbing (all) | project suites pass (copied into functional) | C2 | no — oracle passes; a stricter validator breaks visible tests (reuse_validate) | low |

## 2. Leniency (non-blocking)

| trap / property | most plausible wrong fix | caught? |
|---|---|---|
| T1 metadata aliasing | reject only "."/".."; git-dir containment suffices | yes — WriteDoesNotOverwriteConfig, WriteDoesNotCreateHook, WriteDoesNotAliasReflog, ReadDoesNotReturnMetadata, DeleteDoesNotRemoveMetadata, RenameDoesNotMoveMetadata, WriteSecondImplementationDoesNotAliasMetadata; `miss_alias.patch` |
| T2 second writer | guard the rwfs helper only | yes — WriteSecondImplementation; `miss_norwfs.patch` |
| T9 second writer partial | full rule primary, parent-only norwfs | yes — WriteSecondImplementationDoesNotAliasMetadata; `miss_alias_norwfs.patch` |
| T3 read | guard writes only | yes — ReadDoesNotReturnMetadata, ReadRejectsTraversalName, tag tests; `miss_read.patch` |
| T4 delete | existence check as validation | yes — DeleteDoesNotRemoveMetadata; `miss_delete.patch` |
| T5 reflog family | guard reference sinks only | yes — ReflogAppend/Read/Delete; `miss_reflog.patch` |
| T8 reflog expiry | treat expiry as trusted maintenance | yes — ReflogExpire; `miss_expire.patch` |
| T6 tag shorthand | guard storage only, leave path.Join | yes — TagDoesNotReturnOtherReference, DeleteTagDoesNotDeleteBranch; `miss_tag.patch` |
| T7 rename | source-exists as validation; check source only | yes — RenameDoesNotMoveMetadata, RenameDoesNotMoveTraversalMetadata, RenameDoesNotOverwriteMetadata; `miss_rename.patch` |
| refuse every name | `refuse_all` | yes — functional (reward 0); `refuse_all.patch` |
| reuse existing validator | `ReferenceName.Validate()` | yes — functional plus three security tests; `reuse_validate.patch` |

**Wrong fixes no test catches**

1. A denylist omitting untested root entries (`packed-refs`, `index`, `objects`, `description`, `COMMIT_EDITMSG`) or hardcoded to `{config, hooks, logs}`; `packed-refs` is exercised only via traversal.
2. Case-sensitive match ("CONFIG"); no case variant.
3. Literal `".."` only; no HFS+/NTFS disguise.
4. No symbolic-target validation; no hostile-target test (hardening-only, not a sink).
5. Trailing-dot/space or NTFS ADS metadata spellings; no test, and the oracle would need widening first.

## 3. Hints (non-blocking)

- "Fix the problem and its close variants." signals a variant set. Reword: "Fix the problem."
- Keep "however it reaches the library, and whichever code path acts on it": it is the general quantifier.

## 3a. Required: generalize

- "It must never read, create, change, move or remove a different reference or any other data the repository keeps" — the verbs mirror the traps (read/write/rename/delete/expiry). Reword: "It must leave every other reference and all other data the repository keeps untouched."
- "nothing is created, changed or removed" — same enumeration. Reword: "has no effect on the repository."

## 4. Realism (non-blocking)

T1–T6 are real upstream sinks; T7/T8 are injected but ordinary maintainer-shaped APIs reachable through the public `*filesystem.Storage`, and the repo's own `TestSetRefsNorwfs` shows the second writer is real; T9 is a partial-fix shape. Nothing looks planted.

## 5. Verdict

**GATE A: READY.** All security tests are covered by P read literally, including the tag shorthand and injected rename/expiry via "however it reaches the library, and whichever code path acts on it"; all functional tests are covered by C2. Oracle, alternative and blind fixes score 1.0; guards at the dotgit sinks or at the `ReferenceStorage`/`ReflogStorage` wrappers both pass, and any error counts as refusal. The only tension — a full check-ref-format validator rejecting `refs/heads/.invalid` and `bar` — is a different mechanism that breaks C2 and visible project tests, while the natural containment fix passes. No correct-fix-fails mechanism found.

**Quality to tighten:** add direct write/read/delete tests for the untested metadata entries plus a `checks/miss_partial_list.patch`; add a case-variant ("CONFIG") and a pathutil-style dot-disguise test; widen the oracle before adding trailing-dot/ADS tests; apply the 3a rewordings and drop "and its close variants".

GATE_A: READY
NEEDS_HUMAN_REVIEW: NO
