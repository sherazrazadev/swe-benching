# Human decision: uri.js-s3

DECISION: DROP
DATE: 2026-10-27
BY: project owner
SOURCE: reports/actions/checks/uri.js-s3/FAIRNESS.md and the audits in reports/actions/audits/

WHY: Unfair as built. Every graded run of both models fails only the 8 security/bundle tests, which check the shipped minified browser build src/URI.min.js; the instruction never mentions that file and the repo has no step that builds it (the fairness review raised the same question; 3 of 6 audits called it instruction-ambiguity). DeepSeek runs 1-3 and MiMo runs 1 and 3 pass every other security and functional test, so under a fair test both models solved it and the task is rejected rather than repaired.
