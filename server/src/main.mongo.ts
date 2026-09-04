import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { MongoApiModule } from './mongo-api.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(MongoApiModule);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.enableCors();
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('HideAuto MongoDB Store API').setVersion('experimental').build());
  SwaggerModule.setup('docs', app, document);
  const port = Number(process.env.MONGO_API_PORT ?? 3002);
  await app.listen(port);
  console.log(`MongoDB store API running on http://localhost:${port}`);
}

void bootstrap();
