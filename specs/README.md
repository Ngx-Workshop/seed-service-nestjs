# Feature specifications

## Next task: Code Maintenance

Status: Implemented; integration pending. Locally verified on 2026-11-22.

[Spec](003-code-maintenance/spec.md) · [Plan](003-code-maintenance/plan.md) ·
[Tasks](003-code-maintenance/tasks.md) · [Handoff](003-code-maintenance/handoff.md) ·
[Reusable Copilot prompt](../.github/prompts/code-maintenance.prompt.md)

T001–T010 local work is complete; see the handoff for actual evidence and pending
Docker/live observability checks. Older unfinished work retains its status below.

Keep implementation context in this repository so future agents can resume work
without the original conversation or other repository checkouts.

Use the [workflow](../.specify/README.md) and its templates. Create a folder such
as `001-document-search/` for actual feature work, then replace the empty index
below with relative links. A feature folder contains `spec.md`, `plan.md`,
`tasks.md`, and `handoff.md`; add supporting research/contracts only when useful.

| Feature                | Status | Spec | Plan | Tasks | Handoff |
| ---------------------- | ------ | ---- | ---- | ----- | ------- | --- |
| No feature records yet | —      | —    | —    | —     | —       | —   |

Keep one row per feature, retain completed records for rationale, and update
status when work changes. Select work from the user's request and this index;
the largest folder number is not automatically the active feature.

- [001-deployment-cleanup](001-deployment-cleanup/spec.md): Deployment cleanup; implemented and locally verified.

- [002-service-observability](002-service-observability/spec.md): Implemented and locally verified; Grafana ingestion authorization pending.
