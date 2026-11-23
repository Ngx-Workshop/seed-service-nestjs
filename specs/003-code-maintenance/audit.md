# Code Maintenance audit

## T001 baseline (2026-11-22)

HEAD: `d903c3a1863d67e39ae5fcc99963dc6bf234dc91`. Local Node
`v24.9.0`, npm `11.6.0`; deployment targets Node 22. Installed Nest common
`11.1.3`, Prettier `3.6.2`. Node 22 verification is still required.

Pre-existing work: modified `AGENTS.md`, `specs/README.md`; untracked Copilot
instructions/prompts, workflow audit and this feature folder. Preserve these.
Sibling instruction paths do not exist; the complete local instructions apply.

| Command                                                          | Actual outcome                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm test -- --runInBand`                                        | PASS: 1 suite, 5 observability tests                                                        |
| `GENERATE_OPENAPI=true npm run build`                            | PASS; generated OpenAPI unchanged                                                           |
| `npx --no-install eslint "{src,apps,libs,test}/**/*.ts"`         | FAIL: 13 errors, 1 warning                                                                  |
| `npx --no-install prettier --check "src/**/*.ts" "test/**/*.ts"` | PASS                                                                                        |
| `npm run test:e2e -- --runInBand`                                | FAIL: obsolete `/` expectation, 404 instead of 200; open handles; stopped after 180 seconds |
| `docker info --format '{{.ServerVersion}}'`                      | Unavailable Docker daemon; CLI alone is installed                                           |

No live MongoDB/auth/Grafana integration is claimed. npm reports an inherited
unknown user configuration warning (`scripts-prepend-node-path`).

## T002 source-backed ownership and findings

Dependency graph is acyclic:

- `AppModule` imports configured global `ConfigModule`, conditional Mongoose
  connection, `ExampleMongodbDocModule`, and `ObservabilityModule`.
- Example module imports auth-client and its own Mongoose feature registration;
  owns controller/service/model; exports nothing.
- Observability imports Terminus; owns anonymous health controller. No globals,
  service locator, duplicate business provider, or `forwardRef` found.
- Controllers delegate CRUD; archive-query coercion is HTTP translation, not
  misplaced business logic. Service owns persistence/error mapping, schema owns
  defaults/uniqueness/version hook. No extra repository layer is justified.
- Auth-client is the only upstream adapter; no local cross-domain database access.
  Preserve the installed adapter and its RxJS/Promise behavior.

Priorities and implementation scope:

1. **P1 verification/tooling:** stale e2e suite and missing staged hooks/CI gates.
   Replace the stale smoke test with isolated real-controller/service HTTP
   characterization, including validation and guard boundaries. No database access.
2. **P1 observability:** HTTP UUID is not available to services. Add explicitly
   imported singleton async context, UUID-v4-only incoming correlation, and one
   bounded contextual domain outcome per operation (no content/IDs/raw errors).
   Archive/unarchive must not double-log an internal update.
3. **P2 type safety:** service duplicate-key catches access `any`; schema hook
   casts to `any`; configuration/stubs use async without awaiting; bootstrap lacks
   cookie-parser types; generator accesses unsafe error stack. Fix these concrete
   lint blockers without changing error mapping or persistence options.
4. **P2 DTO ownership:** duplicate update class in `create.dto.ts`; retain its
   import compatibility with a re-export of the canonical `update.dto.ts` class.
5. **Retain:** unguarded CRUD, guarded auth-test, permissive archive query, raw
   malformed-ID behavior, update without `runValidators`, generation environment,
   version/defaults/schema and contract package. These are compatibility boundaries,
   not silently authorized product changes.

Async lifecycles: remove unnecessary `async` only from configuration/generation
stubs; close HTTP fixtures; preserve service async and auth observable behavior.
Bootstrap errors must remain explicit. Formatting scope will cover maintained
source/tests, tooling and CI, not all historical Markdown/generated output.

## Constitution check

All six principles are retained: one owned domain; unchanged HTTP contract and
access policy; unchanged persistence semantics; isolated meaningful regressions;
local documentation and external-owner handoff. No deviation or migration is
required. No contract consumer needs to change for this maintenance.

## T003–T009 implementation and final evidence

Characterization ran before runtime edits: 10 unit tests and 10 isolated HTTP
cases passed. The obsolete e2e test was replaced, not suppressed. Its fixtures
now close the app and mirror runtime validation/cookies without real database
or auth connections.

Final verification on Node `22.23.3`, npm `10.9.9` (2026-11-22):

| Command/check                                                          | Actual outcome                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `npm test -- --runInBand`                                              | PASS: 2 suites, 15 tests                                      |
| `npm run test:e2e -- --runInBand`                                      | PASS: 1 suite, 12 cases; no lingering handles                 |
| `npm run lint:check`                                                   | PASS: no errors or warnings; all 13 inherited errors resolved |
| `npm run format:check`                                                 | PASS: maintained formatting scope; no blanket source rewrite  |
| `GENERATE_OPENAPI=true npm run build`                                  | PASS: compile plus actual OpenAPI generation                  |
| `npm run verify:maintenance`                                           | PASS: all 7 fixture groups below                              |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/test_cleanup_deployment.py` | PASS: 3 tests                                                 |

Hook/install fixture groups (actual clean `npm ci`, real disposable Git commits):

1. Developer hooks installed; staged file formatted; partial staging preserves
   unstaged hunk; unrelated edits unchanged; generated contract excluded.
2. Actual `format:check` rejects deliberate drift without modifying the file.
3. Invalid syntax blocks commit; HEAD and unstaged files remain unchanged.
4. CI install skips hooks.
5. HUSKY=0 install skips hooks.
6. Package-only/no-Git Docker-style install succeeds with normal lifecycles.
7. Production `npm ci --omit=dev` succeeds without Husky.

Fixtures are automatically removed in `finally`; no repository commit/push/
publication/deployment occurred. Local hook configuration is enabled as requested.
Installed pins: Husky `9.1.7`, lint-staged `16.2.7`, cookie-parser types `1.4.9`;
lockfile updated. Node 22.23.5 CI/image execution is not claimed.

Meaningful logging checks include actual native JSON success/failure shape and
context, canary data/error exclusion, warn/error levels, exactly one archive
domain event, per-operation IDs, async isolation, validated incoming UUIDs,
HTTP/domain request correlation and quiet GET/HEAD health. Existing auth protocol
is doubled (both denied and permitted); storage failures remain original errors,
duplicate-key mutations remain 409, not-found remains 404.

Compatibility review: controller and canonical update DTO are unchanged; schema
diff only narrows update shape before the existing increment; auth import/guard
placement unchanged; no validators/query coercion/access-policy change. OpenAPI
and owned contracts remain unchanged, so contract regeneration/release is not
required. No speculative layer or cross-domain adapter was introduced.

Remaining external checks: Docker daemon unavailable, so no actual container
build; no isolated MongoDB supplied, so real persistence/version/concurrency and
auth-service protocol were not integration-tested. Alloy/Grafana ingestion
authorization/receipt remains infrastructure-owned and pending. Production
no-dev startup is not certified (auth-client remains an inherited devDependency).
