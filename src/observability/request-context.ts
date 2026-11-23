import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

@Injectable()
export class RequestContext {
  private readonly storage = new AsyncLocalStorage<string>();

  run<T>(requestId: string, action: () => T): T {
    return this.storage.run(requestId, action);
  }

  get requestId(): string | undefined {
    return this.storage.getStore();
  }
}
