# Round 1 trial evidence: next-auth-s4

Which hidden tests each graded round-1 run FAILED.

| Run | Reward | Failed tests |
|---|---|---|
| deepseek-r1 | 0.0 | functional 2/68: redirect proxy hop > forwards a callback to the app that started the sign-in, without browser cookies, assert GET callback action > Redirect Proxy > should redirect query with state if redirectProxyUrl is defined, and state query contains origin |
| deepseek-r2 | 0.0 | functional 2/68: redirect proxy hop > forwards a callback to the app that started the sign-in, without browser cookies, assert GET callback action > Redirect Proxy > should redirect query with state if redirectProxyUrl is defined, and state query contains origin |
| deepseek-r3 | 0.0 | functional 2/68: redirect proxy hop > forwards a callback to the app that started the sign-in, without browser cookies, assert GET callback action > Redirect Proxy > should redirect query with state if redirectProxyUrl is defined, and state query contains origin |
| mimo-r1 | 0.0 | functional 2/68: redirect proxy hop > forwards a callback to the app that started the sign-in, without browser cookies, assert GET callback action > Redirect Proxy > should redirect query with state if redirectProxyUrl is defined, and state query contains origin |
| mimo-r2 | 0.0 | functional 2/68: redirect proxy hop > forwards a callback to the app that started the sign-in, without browser cookies, assert GET callback action > Redirect Proxy > should redirect query with state if redirectProxyUrl is defined, and state query contains origin |
| mimo-r3 | 1.0 | none (solved) |

Keep the traps the model that failed every run keeps missing; add 2-3 new real traps of the kinds common/builder/BRIEF-trap-stack.md lists for the model that solved it.
