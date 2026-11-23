import {
  configureObservability,
  createServiceLogger,
} from './observability/observability';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: createServiceLogger(),
  });
  configureObservability(app);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
  );

  await app.listen(process.env.PORT ?? 3003, '0.0.0.0');
}
void bootstrap().catch(() => {
  createServiceLogger().error(
    {
      event: 'bootstrap_failed',
      reason: 'startup_failure',
    },
    'Bootstrap'
  );
  process.exit(1);
});
