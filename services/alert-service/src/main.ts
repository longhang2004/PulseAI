import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT_ALERT_SERVICE || 3002;
  await app.listen(port, '0.0.0.0');
  console.log(`Alert Service is running on: http://localhost:${port}`);
}
bootstrap();
