# Human decision: langflow-s3

DECISION: REPAIR
DATE: 2026-10-27
BY: project owner (decision delegated to Claude on 2026-10-27)
SOURCE: reports/actions/checks/langflow-s3/FAIRNESS.md and the audits in reports/actions/audits/

WHY: The instruction says any error status counts as a refusal, but the in-process test client re-raised the app's exception instead of returning a 500, so a fix that blocks the cross-account copy and errors out failed. Fix: reports/actions/fixes/langflow-s3-copy-refusal.patch (raise_app_exceptions=False); the saved runs are re-graded on the fixed tests (regrade workflow).
