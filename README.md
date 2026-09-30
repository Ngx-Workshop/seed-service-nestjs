# NestJS Service Seed

Starter service for Ngx-Workshop: NestJS 11, MongoDB/Mongoose, example document
CRUD, platform auth-client integration, and generated OpenAPI/TypeScript contracts.
The example is a starting point; its current CRUD endpoints are unguarded and its
test scaffold needs adaptation before production use.

## Start here

- [AGENTS.md](AGENTS.md): entry point for AI implementation agents.
- [Architecture](docs/architecture.md): owned data, routes, source map, external contracts.
- [Development](docs/development.md): runtime setup, checks, and known limitations.
- [Project principles](.specify/memory/constitution.md): intended engineering rules.
- [Implementation workflow and templates](.specify/README.md): specify, plan, task, implement, verify.
- [Feature index](specs/README.md): persistent context for implementation work.
- [Seed adoption](docs/seed-adoption.md): turn this seed into a new service.

## Local development

Use Node 22 and install dependencies with `npm ci`. Supply `MONGODB_URI`, optionally
`PORT` (default 3003), and the auth client's configuration for guarded requests.
Then run `npm run start:dev`. See the development guide for a local environment example.

To compile and generate OpenAPI without database wiring:

```bash
GENERATE_OPENAPI=true npm run build
```

The explicit flag is necessary because of the generator's current import ordering.
Do not use it when running the actual API. Contract-generation commands, Docker
filename details, and verification requirements are in the development guide.
