import { Controller, Post, Req, Res, Header, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import { SalesforceService } from '../salesforce/salesforce.service';
import { ConfigService } from '@nestjs/config';

@Controller('twilio')
export class TwilioController {
  constructor(
    private readonly sfService: SalesforceService,
    private readonly configService: ConfigService
  ) {}

  @Post('voice-inbound')
  @Header('Content-Type', 'text/xml')
  async handleInitialCall(@Res() res: Response) {
    const twiml = `
      <Response>
        <Gather numDigits="1" action="/twilio/ivr-language" method="POST">
          <Say voice="alice">Welcome to Aadhavi Essentials support. For Tamil, press 1. For English, press 2.</Say>
        </Gather>
        <Redirect>/twilio/voice-inbound</Redirect>
      </Response>
    `;
    res.status(200).send(twiml);
  }

  @Post('ivr-language')
  @Header('Content-Type', 'text/xml')
  async handleLanguageSelection(@Req() req: Request, @Res() res: Response) {
    const digits = req.body.Digits; // '1' or '2'
    const twiml = `
      <Response>
        <Gather numDigits="5" action="/twilio/process-routing?lang=${digits}" method="POST">
          <Say voice="alice">Please enter your 5 digit customer ID.</Say>
        </Gather>
      </Response>
    `;
    res.status(200).send(twiml);
  }

  @Post('process-routing')
  @Header('Content-Type', 'text/xml')
  async processRouting(@Req() req: Request, @Res() res: Response, @Query('lang') lang: string) {
    const customerId = req.body.Digits;
    const callerPhone = req.body.From;

    const tamilSkillId = this.configService.get<string>('SF_SKILL_TAMIL') || '';
    const englishSkillId = this.configService.get<string>('SF_SKILL_ENGLISH') || '';
    
    const selectedSkillId = lang === '1' ? tamilSkillId : englishSkillId;

    // Execute Salesforce integration asynchronously
    const caseId = await this.sfService.routeAadhaviCall(callerPhone, selectedSkillId, customerId).catch(console.error);
    const twiml = `
      <Response>
       <Gather numDigits="1" action="/twilio/make-call?caseId=${caseId}" method="POST" validDigits="9#">
        <Say voice="alice">Thank you. Your request is registered. To speak to an executive, press 9. To end the call, press hash.</Say>
       </Gather>
       <Say voice="alice">We did not receive any input. Goodbye.</Say>
       <Hangup/>
      </Response>
    `;
    res.status(200).send(twiml);
  }

  @Post('make-call')
  async makeCall(@Req() req: Request, @Res() res: Response, @Query('caseId') caseId: string) {
    const pressedDigit = req.body.Digits;
    // Scenario 1: Customer pressed '#' to end the call
    if (pressedDigit === '#') {
      const twiml = `
        <Response>
          <Say voice="alice">Thank you for calling Aadhavi Essentials. Have a great day. Goodbye.</Say>
          <Hangup/>
        </Response>
      `;
      return res.status(200).send(twiml);
    }
   if (pressedDigit === '9') {
      const ngrokUrl = this.configService.get<string>('NGROK_URL');
      const agentPhoneNumber = '+918526708027'; // todo : dynamic
      const twilioNumber = this.configService.get<string>('TW_PHONE_NUMBER') || '';
      
      const twiml = `
        <Response>
          <Say voice="alice">Connecting you to an executive now. Please hold.</Say>
          <Dial 
            callerId="${twilioNumber}" 
            record="record-from-answer-dual" 
            recordingStatusCallback="${ngrokUrl}/twilio/recording-done?caseId=${caseId}"
          >
              <Number>${agentPhoneNumber}</Number>
          </Dial>
        </Response>
      `;
      return res.status(200).send(twiml);
    }

    // Scenario 3: Fallback (in case they bypass validDigits somehow)
    const errorTwiml = `
      <Response>
        <Say voice="alice">Invalid selection. Goodbye.</Say>
        <Hangup/>
      </Response>
    `;
    return res.status(200).send(errorTwiml);
  }


  @Post('recording-done')
  async handleRecordingCallback(@Req() req: Request, @Res() res: Response, @Query('caseId') caseId: string) {
    // Twilio sends the URL of the processed audio file in the body
    const recordingUrl = req.body.RecordingUrl; 
    
    if (caseId && recordingUrl) {
      await this.sfService.attachRecordingToCase(caseId, recordingUrl);
    }
    
    // Twilio doesn't expect TwiML back here, just a 200 OK acknowledging receipt
    res.status(200).send(); 
  }
}