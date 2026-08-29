import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /**
   * Who the client is, for rate limiting and the session audit trail.
   *
   * `x-forwarded-for` is written by whoever connects, so it is only meaningful when the
   * peer is a proxy that overwrites it. Off by default: compose publishes this API on the
   * host as well as behind the web container, and the Next rewrite passes a client-supplied
   * header straight through — trusting it would let anyone choose their own rate-limit
   * bucket. Set TRUST_PROXY to the proxy's IP or CIDR (or a hop count) once a proxy you
   * control is the only way in.
   */
  app.set('trust proxy', trustProxySetting(process.env.TRUST_PROXY));

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      // Public `/api/v1/media/…` (icons + unwrapped .exe) must be fetchable from the
      // portal origin and from packaged mini apps — default CORP `same-origin` blocks that.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors();

  // Every error leaves as `{ detail, code }` — see the filter for why.
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Store-HideAuto API')
    .setDescription('Script marketplace API for hideflow automation scripts')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);
}

/** '', 'true', '1', 'loopback', '10.0.0.0/8' … — Express accepts several shapes. */
function trustProxySetting(raw?: string): boolean | number | string {
  const value = (raw ?? '').trim();
  if (!value) return false; // socket address only — nobody can forge that
  if (value === 'false') return false;
  if (value === 'true') return true;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : value;
}

bootstrap();
