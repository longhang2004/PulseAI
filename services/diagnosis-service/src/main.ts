import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT_DIAGNOSIS_SERVICE || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Diagnosis Service is running on: http://localhost:${port}`);
}
bootstrap();
