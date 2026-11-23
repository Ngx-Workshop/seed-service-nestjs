import type { Server } from 'node:http';
import {
  Controller,
  Get,
  INestApplication,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Match callable Supertest in CommonJS service builds.
import request = require('supertest');
import { ObservabilityModule } from './observability.module';
import { createServiceLogger, httpLoggingMiddleware } from './observability';
import { RequestContext } from './request-context';

@Controller('items')
class TestController {
  constructor(private readonly context: RequestContext) {}

  @Get(':id')
  async get() {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { ok: true, requestId: this.context.requestId };
  }

  @Get()
  fail() {
    throw new InternalServerErrorException();
  }
}

describe('Service observability', () => {
  let app: INestApplication<Server>;
  const log = jest.fn();
  const warn = jest.fn();
  const error = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ObservabilityModule],
      controllers: [TestController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(
      httpLoggingMiddleware({ log, warn, error }, module.get(RequestContext))
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves an anonymous, non-cached heartbeat without database or auth providers', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      status: 'ok',
      info: { heartbeat: { status: 'up' } },
      error: {},
      details: { heartbeat: { status: 'up' } },
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('logs route templates and timings without request data or concrete identifiers', async () => {
    const response = await request(app.getHttpServer())
      .get('/items/private-person?token=private-query')
      .set('Authorization', 'Bearer private-auth')
      .set('Cookie', 'session=private-cookie')
      .expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_request',
        method: 'GET',
        route: '/items/:id',
        statusCode: 200,
        durationMs: expect.any(Number) as unknown,
        requestId: response.headers['x-request-id'],
      })
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-');
  });

  it('logs unknown routes without their raw paths or query values', async () => {
    await request(app.getHttpServer())
      .get('/private-missing?secret=private-query')
      .expect(404);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/unmatched', statusCode: 404 })
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-');
  });

  it('does not provide a write endpoint for heartbeat', async () => {
    await request(app.getHttpServer())
      .post('/health')
      .send({ secret: 'private-body' })
      .expect(404);
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-body');
  });

  it('keeps HEAD health polls quiet and logs HTTP server failures at error level', async () => {
    await request(app.getHttpServer()).head('/health').expect(200);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    await request(app.getHttpServer()).get('/items').expect(500);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'http_request', statusCode: 500 })
    );
  });

  it('validates incoming UUIDs and isolates concurrent async request context', async () => {
    const ids = [
      'a95cb349-a893-49ce-9185-52685189374a',
      '6bda8fd7-52ea-4635-b2ec-1c685a46b5c2',
    ];
    const responses = await Promise.all(
      ids.map((id) =>
        request(app.getHttpServer())
          .get('/items/id')
          .set('X-Request-ID', id)
          .expect(200)
      )
    );
    responses.forEach((response, index) => {
      expect(response.headers['x-request-id']).toBe(ids[index]);
      expect(response.body).toEqual({ ok: true, requestId: ids[index] });
    });
    const rejected = await request(app.getHttpServer())
      .get('/items/id')
      .set('X-Request-ID', 'private-secret')
      .expect(200);
    expect(rejected.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(rejected.body).toEqual({
      ok: true,
      requestId: rejected.headers['x-request-id'],
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-secret');
  });

  it('uses native Nest JSON logging with a contextual, structured message', () => {
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    try {
      createServiceLogger().log({ event: 'test_event' }, 'ObservabilityTest');
      expect(write).toHaveBeenCalled();
      const entry: unknown = JSON.parse(String(write.mock.calls[0][0]));
      expect(entry).toEqual(
        expect.objectContaining({
          level: 'log',
          context: 'ObservabilityTest',
          message: { event: 'test_event' },
        })
      );
    } finally {
      write.mockRestore();
    }
  });
});
