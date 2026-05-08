import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { urlencoded, json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Standard JSON parser
  app.use(json());
  
  // Crucial for catching Twilio Webhooks
  app.use(urlencoded({ extended: true })); 
  
  await app.listen(3000);
  console.log('Aadhavi CCaaS Hub is running on port 3000');
}
bootstrap();