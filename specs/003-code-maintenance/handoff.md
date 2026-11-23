# Handoff: Code Maintenance

Status: Implemented; integration pending · Updated: 2026-11-22
[Spec](spec.md) · [Plan](plan.md) · [Tasks](tasks.md) · [Evidence](audit.md)

## Implemented locally

- Audited source/module dependencies; retained already-thin controllers and
  cohesive feature boundaries. No speculative persistence layer.
- Consolidated update DTO ownership with a compatible re-export; fixed concrete
  type/lifecycle lint failures without changing persisted fields or HTTP behavior.
- Added pinned Husky/lint-staged, manifest-contained guarded prepare, staged
  Prettier, intentional ignores, and non-mutating lint/format CI gates.
- Added explicit singleton async request-context DI, UUID-v4 header validation
  and safe native contextual CRUD outcomes. Archive/unarchive do not double-log.
  No content, document IDs, credential/error payloads or Grafana credentials.
- Replaced obsolete root smoke test with isolated CRUD HTTP regressions; added
  persistence, redaction, failure-level and correlation tests. Updated context docs.

## Actual verification

Node 22.23.3/npm 10.9.9, 2026-11-22:

- Unit/observability: **15 tests passed** (2 suites).
- Isolated HTTP: **12 cases passed**, including public CRUD, permitted/denied
  auth-test guard doubles, DTO rejection, partial update/archive/delete,
  query coercion, 404/409/500 and HTTP/domain correlation.
- Build plus explicit-mode OpenAPI generation, lint:check and format:check:
  **passed**. Generated OpenAPI and owned contracts unchanged.
- `npm run verify:maintenance`: **7 fixture groups passed**, covering actual
  staged formatting/partial staging/unrelated edits/generated exclusions, failure
  blocking, non-mutating CI rejection, and clean developer/CI/HUSKY=0/no-Git/
  production-without-dev install lifecycles. Temporary repositories removed.
- Deployment cleanup regression: **3 tests passed**.

Baseline differences are recorded in [audit.md](audit.md): originally 5 tests
passed, build/format passed, lint had 13 errors plus 1 warning, and the stale
e2e failed/hung. Those local failures are resolved, not hidden.

## Compatibility and remaining checks

No public contract, persisted schema, access-policy, external auth protocol or
consumer version change is intended. No contract publication/migration is needed.
Preserved permissive query parsing, malformed-ID behavior, update options and
unguarded demonstration CRUD. Original unrelated work remains in the worktree.
No commit, push, publish or deployment was performed in this repository.

Local JSON tests do **not** certify Grafana receipt. External owner
`nginx-ngx-workshop.io` owns Alloy/dashboard/ingestion authorization. Next action:
authorize host ingestion and, after approved deployment, verify success/failure
domain JSON and a matching HTTP requestId in Loki; confirm quiet health and
bounded labels. No credentials or infrastructure checkout is required locally.

Docker CLI exists but its daemon is unavailable; package-only Docker-style
install passed, actual Node 22.23.5 image build remains pending. MongoDB/auth
integration was not run; use disposable infrastructure to verify real version/
concurrency and upstream protocol behavior. Production `--omit=dev` installation
passed, but startup is not certified: auth-client is an inherited devDependency
and the current Docker image retains development dependencies.

## Next maintainer action

Review the local changes and [audit evidence](audit.md). When Docker is available,
build the existing image without deploying; arrange the external checks above.
Older unfinished feature records remain independent. Do not rerun maintenance
from T001 or treat live observability as already complete.
