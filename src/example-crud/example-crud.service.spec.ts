import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { createModelDouble } from '../../test/example-model.fixture';
import { ExampleCrudService } from './example-crud.service';
import { ObservabilityModule } from '../observability/observability.module';
import { RequestContext } from '../observability/request-context';
import { createServiceLogger } from '../observability/observability';
import {
  ExampleMongodbDoc,
  ExampleMongodbDocEnum,
} from './schemas/example-mongodb-doc.schema';

describe('Example CRUD persistence boundary', () => {
  let service: ExampleCrudService;
  let model: ReturnType<typeof createModelDouble>;
  let context: RequestContext;
  let log: jest.SpyInstance<
    void,
    [{ operationId: string; requestId?: string }, ...unknown[]]
  >;
  let warn: jest.SpyInstance<void, [unknown, ...unknown[]]>;
  let error: jest.SpyInstance<void, [unknown, ...unknown[]]>;

  beforeEach(async () => {
    model = createModelDouble();
    const module = await Test.createTestingModule({
      imports: [ObservabilityModule],
      providers: [
        ExampleCrudService,
        { provide: getModelToken(ExampleMongodbDoc.name), useValue: model },
      ],
    }).compile();
    service = module.get(ExampleCrudService);
    context = module.get(RequestContext);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates with a server timestamp and returns the saved document', async () => {
    const input = { name: 'example', type: ExampleMongodbDocEnum.SOME_ENUM };
    const saved = { ...input, version: 1 };
    model.save.mockResolvedValue(saved);
    await expect(service.create(input)).resolves.toEqual(saved);
    expect(model).toHaveBeenCalledWith({
      ...input,
      lastUpdated: expect.any(Date) as unknown,
    });
  });

  it.each(['create', 'update'] as const)(
    'maps duplicate keys to the existing conflict for %s, but preserves storage errors',
    async (operation) => {
      const input = { name: 'example', type: ExampleMongodbDocEnum.SOME_ENUM };
      const invoke = () =>
        operation === 'create'
          ? service.create(input)
          : service.update('id', input);
      const result = operation === 'create' ? model.save : model.exec;
      result.mockRejectedValue({ code: 11000 });
      await expect(invoke()).rejects.toEqual(
        new ConflictException('ExampleMongodbDoc with this name already exists')
      );
      const failure = new Error('storage failure');
      result.mockRejectedValue(failure);
      await expect(invoke()).rejects.toBe(failure);
    }
  );

  it('preserves list filters and not-found semantics', async () => {
    model.exec.mockResolvedValue([]);
    await service.findAll();
    await service.findAll(false);
    expect(model.find.mock.calls).toEqual([[{}], [{ archived: false }]]);
    model.exec.mockResolvedValue(null);
    await expect(service.findOne('id')).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.findByName('name')).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.remove('id')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('updates and archives through the same persistence semantics', async () => {
    model.exec.mockResolvedValue({ archived: true });
    await service.archive('id');
    await service.unarchive('id');
    expect(model.findByIdAndUpdate.mock.calls).toEqual([
      [
        'id',
        { archived: true, lastUpdated: expect.any(Date) as unknown },
        { new: true },
      ],
      [
        'id',
        { archived: false, lastUpdated: expect.any(Date) as unknown },
        { new: true },
      ],
    ]);
    model.exec.mockResolvedValue(null);
    await expect(service.update('id', {})).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('logs single safe outcomes without DTO content, identifiers or storage errors', async () => {
    model.save.mockResolvedValue({ name: 'private-result' });
    model.exec.mockResolvedValue({ archived: true });
    await service.create({
      name: 'private-name',
      type: ExampleMongodbDocEnum.SOME_ENUM,
      description: 'private-token-cookie-body',
    });
    await service.archive('private-id');
    expect(log).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        event: 'example_crud_operation',
        operation: 'archive',
        outcome: 'success',
        operationId: expect.any(String) as unknown,
        durationMs: expect.any(Number) as unknown,
      })
    );
    model.exec.mockResolvedValue(null);
    await expect(service.findByName('private-name')).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'not_found', statusCode: 404 })
    );
    model.save.mockRejectedValue({ code: 11000, detail: 'private-duplicate' });
    await expect(
      service.create({
        name: 'private-name',
        type: ExampleMongodbDocEnum.SOME_ENUM,
      })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(warn).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: 'conflict', statusCode: 409 })
    );
    const failure = new Error('private-password-upstream');
    model.exec.mockRejectedValue(failure);
    await expect(service.findOne('private-id')).rejects.toBe(failure);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'storage_failure',
        outcome: 'failure',
        statusCode: 500,
      })
    );
    expect(
      JSON.stringify([log.mock.calls, warn.mock.calls, error.mock.calls])
    ).not.toContain('private-');
  });

  it('isolates concurrent request contexts and gives background work only an operation ID', async () => {
    model.exec.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 5))
    );
    await Promise.all([
      context.run('first-request', () => service.findAll()),
      context.run('second-request', () => service.findAll()),
    ]);
    expect(log.mock.calls.map(([entry]) => entry.requestId)).toEqual([
      'first-request',
      'second-request',
    ]);
    expect(context.requestId).toBeUndefined();
    await service.findAll();
    expect(log.mock.calls[2][0]).not.toHaveProperty('requestId');
    expect(
      new Set(log.mock.calls.map(([entry]) => entry.operationId)).size
    ).toBe(3);
  });

  it('emits the actual domain payload through native JSON with context and level', async () => {
    log.mockRestore();
    error.mockRestore();
    Logger.overrideLogger(createServiceLogger());
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const stderr = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    try {
      model.exec.mockResolvedValue([]);
      await service.findAll();
      model.exec.mockRejectedValue(new Error('private-password'));
      await expect(service.findAll()).rejects.toThrow('private-password');
      const entries = [...stdout.mock.calls, ...stderr.mock.calls].map(
        ([line]) => JSON.parse(String(line)) as unknown
      );
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'log',
            context: 'ExampleCrudService',
            message: expect.objectContaining({
              event: 'example_crud_operation',
              outcome: 'success',
            }) as unknown,
          }),
          expect.objectContaining({
            level: 'error',
            context: 'ExampleCrudService',
            message: expect.objectContaining({
              outcome: 'failure',
              reason: 'storage_failure',
            }) as unknown,
          }),
        ])
      );
      expect(JSON.stringify(entries)).not.toContain('private-');
    } finally {
      Logger.overrideLogger(false);
    }
  });
});
