import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SalesforceService } from './salesforce/salesforce.service';
import { TwilioController } from './twilio/twilio.controller';
import { WhatsappController } from './whatsapp/whatsapp.controller';
import { VoiceController } from './voice/voice.controller';
import { AiService } from './ai/ai.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Loads the .env file
    HttpModule,
  ],
  controllers: [AppController, TwilioController, WhatsappController, VoiceController],
  providers: [AppService, SalesforceService, AiService],
})
export class AppModule {}