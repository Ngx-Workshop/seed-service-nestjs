# Development and verification

Run commands from this repository root. Use Node 22, matching Docker/CI, and the
committed lockfiles. Registry access may be required for `@tmdjr/ngx-auth-client`.

## Runtime setup

Install with `npm ci`. Supply a local `.env` or environment containing:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/seed_service_dev
PORT=3003
AUTH_BASE_URL=http://localhost:3000
```

The URI is an example for a disposable local database. The auth URL is a
placeholder for your actual auth service; it does not launch one. Inspect the
installed auth-client package for additional configuration before testing guarded
routes. Never set `GENERATE_OPENAPI=true` when running the real API.

| Purpose                   | Command                                 | Notes                                                                         |
| ------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| Development               | `npm run start:dev`                     | Requires reachable MongoDB                                                    |
| Build and OpenAPI         | `GENERATE_OPENAPI=true npm run build`   | `postbuild` generates `openapi.json`; explicit flag avoids import-order issue |
| Regenerate OpenAPI        | `GENERATE_OPENAPI=true npm run openapi` | Uses existing compiled output; build first after source changes               |
| Production runtime        | `npm run start:prod`                    | Runs compiled code with runtime environment                                   |
| Unit tests                | `npm test -- --runInBand`               | CRUD persistence/logging and observability suites                             |
| End-to-end tests          | `npm run test:e2e -- --runInBand`       | Isolated real-controller/service HTTP tests, model and auth guard doubles     |
| Lint                      | `npm run lint`                          | Uses `--fix` and can modify files; inspect resulting changes                  |
| Non-mutating lint         | `npm run lint:check`                    | Used by validation and pre-publication CI                                     |
| Non-mutating formatting   | `npm run format:check`                  | Source/tests, tooling, root config and CI; generated output excluded          |
| Hook/install verification | `npm run verify:maintenance`            | Disposable installs/Git fixtures; registry access, no deployment              |

## Staged formatting

`npm ci` enables Husky in a developer Git checkout. The pre-commit hook runs the
installed lint-staged binary (no download-on-commit) and Prettier for staged
TS/JS/JSON/Markdown/YAML files. lint-staged hides/restores partially staged edits;
do not disable its stash/hide behavior. A formatter failure blocks the commit.
Generated contracts/OpenAPI, lockfiles, dependency/vendor and build/coverage
output are ignored. Historical documentation is not part of the CI formatting
migration; Markdown files are still formatted when deliberately staged.

The manifest-contained prepare lifecycle skips hook setup for CI, `HUSKY=0`,
production/no-dev installs, no Git metadata, or absent Husky. Docker still copies
only manifests before `npm ci`; no hook installer file is needed. Normal installs
retain other package lifecycle scripts. `verify:maintenance` tests real commits
only in automatically removed temporary repositories, including partial staging,
an unrelated unstaged file, generated exclusions, failure blocking and a
non-mutating negative formatting check.

Validation runs on pull requests/main; the existing publish workflow runs the
same checks before building/publishing. Local evidence uses Node 22.23.3/npm
10.9.9; CI/Docker remain pinned to Node 22.23.5. Package-only installs were tested;
an actual image build requires a running Docker daemon. Production `--omit=dev`
installation passing does not certify production startup: the inherited auth
client is still a devDependency, and Docker currently retains devDependencies.

## API/contract changes

1. Update DTO decorators, controller responses, service behavior, and schema as
   required by the feature; keep compatibility decisions in its plan.
2. Run `GENERATE_OPENAPI=true npm run build`.
3. Install contract tooling with `npm --prefix contracts/seed-service-nestjs ci`.
4. Run `npm run contracts:seed-service-nestjs:gen` and
   `npm run contracts:seed-service-nestjs:build`.
5. Review OpenAPI and generated type differences, public exports, required/optional
   fields, status codes, and downstream impact. Record the results.

Publishing is a separate release action. The publish script invokes
`prepublishOnly`, which cleans, regenerates, and builds the contract package.
Generated files must not replace DTO/controller source as the source of truth.
Do not claim a version is published merely because local generation succeeded.

## Docker

The tracked Compose file is named `docker-compose.yml `, with a trailing space.
Use `docker compose -f 'docker-compose.yml ' up --build` until that filename is
deliberately corrected. The file expects `.env` and an existing `ngx-net` network;
it does not start MongoDB or auth. Container connections need addresses reachable
from inside Docker, not the host-only localhost example above.

## Verification for implementations

- Add focused tests for changed controller/service behavior, DTO rejection,
  access policy, not-found/conflict responses, archive state, and version changes
  as applicable. Use model/guard doubles for unit tests.
- For HTTP tests, reproduce the global validation and cookie setup from `main.ts`.
  Use a disposable database when verifying real persistence behavior.
- For changed endpoints, build and regenerate contracts, then validate representative
  requests/responses. For auth changes include allowed and denied cases.
- Record commands, pass/fail/blocked outcomes, and missing environment requirements
  in the handoff. Unit or build success does not prove live gateway integration.
- For documentation-only changes, check paths, links, accuracy, and whitespace;
  application builds are normally unnecessary.

## Known inherited limitations

Source observations from 2026-09-29; these are not executed test results.

- `src/swagger.ts` imports `AppModule` before setting `GENERATE_OPENAPI` inside its
  function. Conditional imports/providers are evaluated earlier. Set the flag in
  the command environment as shown above; Docker and CI already do this.
- HTTP regression tests reproduce global validation and close the application.
  They exercise real controller/service behavior with persistence and guard doubles,
  not a live MongoDB/auth deployment. They do not certify the external auth-client
  protocol or MongoDB concurrency/version behavior.
- Only `auth-test` has a guard. The demonstration write endpoints are unguarded;
  a production feature must define its access requirements explicitly.
- `UpdateExampleMongodbDocDto` is owned by `update.dto.ts`, with an import-compatible
  re-export from `create.dto.ts`.
- IDs are passed directly to Mongoose; `findByIdAndUpdate` does not request
  `runValidators`. Query values other than literal `true`/`false` leave archive
  filtering unset. Decide and test the intended semantics when touching these areas.
- The contracts entry point uses `@ts-ignore` for generated exports. A successful
  compile alone is insufficient: verify generated public exports exist and match
  consumer imports.

Remove/update limitations when fixed. Update architecture and environment guidance
whenever the corresponding implementation changes.

## Deployment storage policy

See [deployment cleanup](deployment-cleanup.md) for success-only image/container retention and local verification.

## Service observability

See [logging and heartbeat](observability.md) for operational endpoint semantics, JSON logging, collector ownership and actual validation.

Deployment and npm publication now follow [deployment-workflows](deployment-workflows.md).
