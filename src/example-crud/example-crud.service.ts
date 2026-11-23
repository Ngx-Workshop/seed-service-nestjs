import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { lastValueFrom, of } from 'rxjs';
import { RequestContext } from '../observability/request-context';
import { CreateExampleMongodbDocDto } from './dto/create.dto';
import { UpdateExampleMongodbDocDto } from './dto/update.dto';
import {
  ExampleMongodbDoc,
  ExampleMongodbDocDocument,
} from './schemas/example-mongodb-doc.schema';

type CrudOperation =
  | 'create'
  | 'find_all'
  | 'find_one'
  | 'find_by_name'
  | 'update'
  | 'remove'
  | 'archive'
  | 'unarchive';

@Injectable()
export class ExampleCrudService {
  private readonly logger = new Logger(ExampleCrudService.name);

  constructor(
    @InjectModel(ExampleMongodbDoc.name)
    private readonly exampleMongodbDocModel: Model<ExampleMongodbDocDocument>,
    private readonly context: RequestContext
  ) {}

  async authTest(): Promise<{ message: string }> {
    return lastValueFrom(of({ message: 'Authentication successful Service' }));
  }

  async create(input: CreateExampleMongodbDocDto): Promise<ExampleMongodbDoc> {
    return this.observe('create', () => {
      const document = new this.exampleMongodbDocModel({
        ...input,
        lastUpdated: new Date(),
      });
      return document.save();
    });
  }

  async findAll(archived?: boolean): Promise<ExampleMongodbDoc[]> {
    return this.observe('find_all', () =>
      this.exampleMongodbDocModel
        .find(archived !== undefined ? { archived } : {})
        .exec()
    );
  }

  async findOne(id: string): Promise<ExampleMongodbDoc> {
    return this.observe('find_one', async () => {
      const document = await this.exampleMongodbDocModel.findById(id).exec();
      if (!document) {
        throw new NotFoundException(
          `ExampleMongodbDoc with ID "${id}" not found`
        );
      }
      return document;
    });
  }

  async findByName(name: string): Promise<ExampleMongodbDoc> {
    return this.observe('find_by_name', async () => {
      const document = await this.exampleMongodbDocModel
        .findOne({ name })
        .exec();
      if (!document) {
        throw new NotFoundException(
          `ExampleMongodbDoc with name "${name}" not found`
        );
      }
      return document;
    });
  }

  async update(
    id: string,
    input: UpdateExampleMongodbDocDto
  ): Promise<ExampleMongodbDoc> {
    return this.observe('update', () => this.updateDocument(id, input));
  }

  private async updateDocument(
    id: string,
    input: UpdateExampleMongodbDocDto
  ): Promise<ExampleMongodbDoc> {
    const document = await this.exampleMongodbDocModel
      .findByIdAndUpdate(
        id,
        { ...input, lastUpdated: new Date() },
        { new: true }
      )
      .exec();
    if (!document) {
      throw new NotFoundException(
        `ExampleMongodbDoc with ID "${id}" not found`
      );
    }
    return document;
  }

  async remove(id: string): Promise<void> {
    return this.observe('remove', async () => {
      const result = await this.exampleMongodbDocModel
        .findByIdAndDelete(id)
        .exec();
      if (!result) {
        throw new NotFoundException(
          `ExampleMongodbDoc with ID "${id}" not found`
        );
      }
    });
  }

  async archive(id: string): Promise<ExampleMongodbDoc> {
    return this.observe('archive', () =>
      this.updateDocument(id, { archived: true })
    );
  }

  async unarchive(id: string): Promise<ExampleMongodbDoc> {
    return this.observe('unarchive', () =>
      this.updateDocument(id, { archived: false })
    );
  }

  private async observe<T>(
    operation: CrudOperation,
    action: () => Promise<T>
  ): Promise<T> {
    const started = process.hrtime.bigint();
    const metadata = {
      event: 'example_crud_operation',
      operation,
      operationId: randomUUID(),
      ...(this.context.requestId ? { requestId: this.context.requestId } : {}),
    };
    const durationMs = () =>
      Math.round(Number(process.hrtime.bigint() - started) / 1e6);
    try {
      const result = await action();
      this.logger.log({
        ...metadata,
        outcome: 'success',
        durationMs: durationMs(),
      });
      return result;
    } catch (error: unknown) {
      const duplicateKey =
        ['create', 'update', 'archive', 'unarchive'].includes(operation) &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000;
      const failure = duplicateKey
        ? new ConflictException(
            'ExampleMongodbDoc with this name already exists'
          )
        : error;
      const statusCode =
        failure instanceof HttpException ? failure.getStatus() : 500;
      const entry = {
        ...metadata,
        outcome: 'failure',
        durationMs: durationMs(),
        statusCode,
        reason:
          statusCode === 409
            ? 'conflict'
            : statusCode === 404
              ? 'not_found'
              : 'storage_failure',
      };
      if (statusCode >= 500) this.logger.error(entry);
      else this.logger.warn(entry);
      throw failure;
    }
  }
}
