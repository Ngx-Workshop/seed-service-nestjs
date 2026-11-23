import {
  ForbiddenException,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RemoteAuthGuard } from '@tmdjr/ngx-auth-client';
import * as cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS callable Supertest.
import request = require('supertest');
import { ExampleCrudController } from '../src/example-crud/example-crud.controller';
import { ExampleCrudService } from '../src/example-crud/example-crud.service';
import { createModelDouble } from './example-model.fixture';
import { ExampleMongodbDoc } from '../src/example-crud/schemas/example-mongodb-doc.schema';
import { ObservabilityModule } from '../src/observability/observability.module';
import { configureObservability } from '../src/observability/observability';

describe('Example CRUD HTTP contract (isolated persistence/auth)', () => {
  let app: INestApplication<Server>;
  let authAllowed = false;
  const model = createModelDouble();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ObservabilityModule],
      controllers: [ExampleCrudController],
      providers: [
        ExampleCrudService,
        { provide: getModelToken(ExampleMongodbDoc.name), useValue: model },
      ],
    })
      .overrideGuard(RemoteAuthGuard)
      .useValue({
        canActivate: () => {
          if (authAllowed) return true;
          throw new ForbiddenException();
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureObservability(app);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    authAllowed = false;
    model.exec.mockResolvedValue({ name: 'example', archived: false });
    model.save.mockResolvedValue({ name: 'example', version: 1 });
  });

  it('leaves CRUD public and retains the auth-test guard boundary', async () => {
    await request(app.getHttpServer())
      .get('/example-crud/auth-test')
      .expect(403);
    await request(app.getHttpServer()).get('/example-crud/id').expect(200);
    await request(app.getHttpServer())
      .post('/example-crud')
      .send({ name: 'example', type: 'SOME_ENUM' })
      .expect(201, { name: 'example', version: 1 });
  });

  it('retains the authenticated auth-test response when the guard permits access', async () => {
    authAllowed = true;
    await request(app.getHttpServer())
      .get('/example-crud/auth-test')
      .expect(200, { message: 'Authentication successful Service' });
  });

  it.each([
    { name: '', type: 'SOME_ENUM' },
    { name: 'example', type: 'invalid' },
    { name: 'example', type: 'SOME_ENUM', extra: true },
    {
      name: 'example',
      type: 'SOME_ENUM',
      exampleMongodbDocObject: { city: 'x' },
    },
  ])('rejects invalid create input before persistence: %j', async (body) => {
    await request(app.getHttpServer())
      .post('/example-crud')
      .send(body)
      .expect(400);
    expect(model.save).not.toHaveBeenCalled();
  });

  it('retains partial updates, archive/unarchive, and delete 204', async () => {
    await request(app.getHttpServer())
      .patch('/example-crud/id')
      .send({ description: 'changed' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/example-crud/id/archive')
      .expect(200);
    await request(app.getHttpServer())
      .patch('/example-crud/id/unarchive')
      .expect(200);
    await request(app.getHttpServer())
      .delete('/example-crud/id')
      .expect(204, '');
  });

  it.each([
    ['true', { archived: true }],
    ['false', { archived: false }],
    ['invalid', {}],
  ])('retains archived query coercion: %s', async (query, filter) => {
    model.exec.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get(`/example-crud?archived=${query}`)
      .expect(200, []);
    expect(model.find).toHaveBeenCalledWith(filter);
  });

  it('preserves not-found, conflict and unhandled persistence error responses', async () => {
    model.exec.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/example-crud/id').expect(404);
    await request(app.getHttpServer())
      .get('/example-crud/name/missing')
      .expect(404);
    model.save.mockRejectedValue({ code: 11000 });
    await request(app.getHttpServer())
      .post('/example-crud')
      .send({ name: 'example', type: 'SOME_ENUM' })
      .expect(409);
    model.exec.mockRejectedValue(new Error('storage unavailable'));
    await request(app.getHttpServer())
      .get('/example-crud/malformed')
      .expect(500);
  });

  it('correlates an actual domain operation with its HTTP response and access event', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    try {
      const id = '8b023f71-5d98-44df-af38-9b2d7dbf2ee4';
      await request(app.getHttpServer())
        .patch('/example-crud/private-id/archive')
        .set('X-Request-ID', id)
        .expect('X-Request-ID', id)
        .expect(200);
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'example_crud_operation',
          operation: 'archive',
          requestId: id,
        })
      );
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'http_request', requestId: id })
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain('private-id');
      expect(log).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
  });
});
