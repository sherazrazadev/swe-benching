# Round 1 trial evidence: anubis-s4

Which hidden tests each graded round-1 run FAILED.

| Run | Reward | Failed tests |
|---|---|---|
| deepseek-r1 | 0.2222 | security 7/9: TestSec_ExpressionPath_ForwardedRequest, TestSec_ExpressionPath_RequestWithParameters, TestSec_ExpressionParameters_ForwardedRequest, TestSec_ExpressionWholeURL_ForwardedRequest, TestSec_PathRegex_ForwardedRequest, TestSec_PathRegex_RequestWithParametersForwarded, TestSec_PathPrefix_ForwardedRequest |
| deepseek-r2 | 0.0 | functional 1/14: TestFunc_ProxySuppliedClientURLWins |
| deepseek-r3 | 0.0 | functional 1/14: TestFunc_ProxySuppliedClientURLWins |
| mimo-r2 | 1.0 | none (solved) |
| mimo-r3 | 0.2222 | security 7/9: TestSec_ExpressionPath_ForwardedRequest, TestSec_ExpressionPath_RequestWithParameters, TestSec_ExpressionParameters_ForwardedRequest, TestSec_ExpressionWholeURL_ForwardedRequest, TestSec_PathRegex_ForwardedRequest, TestSec_PathRegex_RequestWithParametersForwarded, TestSec_PathPrefix_ForwardedRequest |

Keep the traps the model that failed every run keeps missing; add 2-3 new real traps of the kinds common/builder/BRIEF-trap-stack.md lists for the model that solved it.
