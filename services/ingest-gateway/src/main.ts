import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  const port = process.env.PORT_INGEST_GATEWAY || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Ingest Gateway is running on: http://localhost:${port}`);
}
bootstrap();
