# Batch 12

Started 2026-10-28T16:15Z. [run 40724061049](https://github.com/sherazrazadev/swe-benching/actions/runs/40724061049) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40724061049)

| Task | Gate | DeepSeek rewards | MiMo rewards | Outcome |
|---|---|---|---|---|
| `dulwich-s4` | sound | 1 | 1 | **REJECTED** |
| `decepticon-s4` | sound | 1 | 0 | **REJECTED** |
| `winter-s4` | sound | 0.8235 0 0 | 0 0 0 0 0 | **ACCEPTED** |
| `dozzle-s4` | sound | 1 | 1 | **REJECTED** |
| `appium-mcp-s4` | sound | 1 | 1 | **REJECTED** |
| `phpsysinfo-s4` | sound | 1 | 1 | **REJECTED** |

## Accepted tasks

### `winter-s4`

- A CMS lets template content execute PHP, change stored files and change stored records even with safe mode enabled.
- CWE-693, php, https://github.com/wintercms/winter
- DeepSeek 0.8235 0 0 / MiMo 0 0 0 0 0
- [Final verdict details](verdicts/winter-s4.md)
