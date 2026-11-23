# Service workflow audit — 2026-11-22

Scope: all 13 root service repositories with `@nestjs/core`, plus the NestJS seed.
All working trees were clean at audit start. Eight already had the complete local
Markdown workflow; six were missing it. Auth and user-metadata had historical
specs, preserved during adoption. The other four missing repositories had no specs.
All 14 had Prettier and native structured HTTP logging; none had Husky/lint-staged.

The same standalone workflow now exists in every repository, with an explicit
next task, Code Maintenance, plus a Copilot instructions bridge and reusable prompt.
This installs the repository's existing Spec Kit-inspired Markdown convention,
not the upstream CLI. Runtime refactors, hooks and domain logs are planned work.

| Repository                  | Workflow at audit / action  | Next feature           |
| --------------------------- | --------------------------- | ---------------------- |
| `seed-service-nestjs`       | Present — retained          | `003-code-maintenance` |
| `service-ai-chat`           | Present — retained          | `004-code-maintenance` |
| `service-ai-publisher`      | Present — retained          | `006-code-maintenance` |
| `service-assessment-test`   | Present — retained          | `007-code-maintenance` |
| `service-auth`              | Missing/partial — installed | `006-code-maintenance` |
| `service-backstage`         | Missing/partial — installed | `001-code-maintenance` |
| `service-bff-ngx-workshop`  | Missing/partial — installed | `001-code-maintenance` |
| `service-coding-labs`       | Present — retained          | `006-code-maintenance` |
| `service-document`          | Present — retained          | `010-code-maintenance` |
| `service-mcp-gateway`       | Present — retained          | `012-code-maintenance` |
| `service-mfe-orchestrator`  | Missing/partial — installed | `001-code-maintenance` |
| `service-navigational-list` | Missing/partial — installed | `001-code-maintenance` |
| `service-uploader`          | Present — retained          | `010-code-maintenance` |
| `service-user-metadata`     | Missing/partial — installed | `002-code-maintenance` |

Each next feature has spec, plan, unchecked tasks and handoff; AGENTS.md and the
feature index point to it explicitly. Existing task statuses were not rewritten.
Plans record the inspected HEAD, installed versions, actual source paths,
service-specific boundaries and installation/collector risks. Implementation
starts with baseline evidence and an architecture audit, then characterization,
refactoring, hooks/CI, domain logging, verification and handoff.

Verification: all 14 setups and next-task links validated; new local documentation
links resolved, feature numbers unique, ten pending tasks per repository, and
`git diff --check` passed. Only Markdown context/workflow/prompt files changed.
No application test, build, dependency install, commit, push or deployment was run.
