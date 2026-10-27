# Batch 2

Started 2026-10-26T22:41Z. [run 40414311131](https://github.com/sherazrazadev/swe-benching/actions/runs/40414311131) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40414311131)

| Task | Gate | DeepSeek rewards | MiMo rewards | Outcome |
|---|---|---|---|---|
| `comfyui-manager-s3` | sound | 0.9 0 0 | 0 0 0 | **accepted** |
| `mlflow-s3` | unsound | - | - | **unsound** |
| `langflow-s3` | sound | 0.9286 0.7857 0.7857 | 0.7143 0 0.9286 | **accepted** |
| `jenkins-s3` | sound | 0.6 0.6 0.6 | 0 0 0 | **accepted** |
| `avideo-s3` | sound | 0 0 0 | 0 0 0 | **accepted** |
| `openremote-s3` | - | - | - | **build failed** |
| `fabio-s3` | sound | 1 | 1 | **rejected** |

## Accepted tasks

### `comfyui-manager-s3`

- Close a policy bypass in ComfyUI-Manager where state a client can write through the host's user-file endpoints decides what the product allows, trusts or runs.
- CWE-420, Python, https://github.com/Comfy-Org/ComfyUI-Manager
- DeepSeek 0.9 0 0 / MiMo 0 0 0
- Final verdict: **NEEDS FIX** ([details](verdicts/comfyui-manager-s3.md))

### `langflow-s3`

- Keep the MCP and file surfaces inside the caller's own account, project and container.
- CWE-639, Python, https://github.com/langflow-ai/langflow
- DeepSeek 0.9286 0.7857 0.7857 / MiMo 0.7143 0 0.9286
- Final verdict: **NEEDS HUMAN DECISION** ([details](verdicts/langflow-s3.md))

### `jenkins-s3`

- A submitted configuration document can make the controller instantiate and keep objects of a type the configured setting does not hold, and can recreate internal request-routing and plugin objects.
- CWE-502, Java, https://github.com/jenkinsci/jenkins
- DeepSeek 0.6 0.6 0.6 / MiMo 0 0 0
- Final verdict: **NEEDS RE-RUN** ([details](verdicts/jenkins-s3.md))

### `avideo-s3`

- A forged payment notification can credit a chosen account with a chosen amount through the wallet of a video platform's payment integration.
- CWE-345, PHP, https://github.com/WWBN/AVideo
- DeepSeek 0 0 0 / MiMo 0 0 0
- Final verdict: **NEEDS FIX** ([details](verdicts/avideo-s3.md))
