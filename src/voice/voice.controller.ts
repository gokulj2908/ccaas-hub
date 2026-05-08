import { Controller, Post, Req, Res, Header } from '@nestjs/common';
import { Request, Response } from 'express';
import { SalesforceService } from '../salesforce/salesforce.service';
import { AiService } from 'src/ai/ai.service';

@Controller('voice')
export class VoiceController {
  
  constructor(
    private readonly sfService: SalesforceService,
    private readonly aiService: AiService
  ) {}

  // 1. The Entry Point (When the phone rings)
  @Post('inbound')
  @Header('Content-Type', 'text/xml')
  handleInboundCall(@Req() req: Request, @Res() res: Response) {
    // We use <Gather input="speech"> to activate Twilio's Speech-to-Text engine.
    // Whatever the user says is sent to the 'action' URL (/voice/process-speech).
    const twiml = `
      <Response>
        <Gather input="speech" action="/voice/process-speech" timeout="5" speechTimeout="auto">
          <Say voice="alice">Welcome to Aadhavi Essentials. How can I help you today?</Say>
        </Gather>
        <!-- Fallback if they stay silent -->
        <Say voice="alice">We didn't hear anything. Goodbye.</Say>
        <Hangup/>
      </Response>
    `;
    return res.status(200).send(twiml);
  }

  // 2. The AI Brain Engine (Processing the speech)
  @Post('process-speech')
  @Header('Content-Type', 'text/xml')
  async processSpeech(@Req() req: Request, @Res() res: Response) {
    // Twilio sends the transcribed text in 'req.body.SpeechResult'
    const userSpeech = req.body.SpeechResult;
    const callerPhone = req.body.From;

    if (!userSpeech) {
      return res.status(200).send(`<Response><Say>I didn't catch that. Goodbye.</Say><Hangup/></Response>`);
    }

    console.log(`[Voice IVR] Caller ${callerPhone} said: "${userSpeech}"`);

    try {
      // ==========================================
      // THE OMNICHANNEL MAGIC HAPPENS HERE
      // You reuse your EXACT SAME logic from WhatsApp!
      // ==========================================
      
       const customer = await this.sfService.findCustomerByPhone(callerPhone);
       let aiResponse = await this.aiService.generateReply(userSpeech, customer);
       console.log(`[RAW AI Output]: ${aiResponse}`);

      // For testing right now, we will simulate Gemini's response:
      // let aiResponse = `You said: ${userSpeech}. I am your A.I. assistant. I am processing this request in Salesforce now.`;

      // ARCHITECT'S GOTCHA: Voice engines cannot read Markdown! 
      // You MUST strip out asterisks (*) and hashes (#) before sending it to <Say>.
      aiResponse = aiResponse
        .replace(/[*#_]/g, '')     // Remove Markdown formatting
        .replace(/&/g, ' and ')    // Twilio crashes on &, replace with the word 'and'
        .replace(/</g, '')         // Twilio crashes on <
        .replace(/>/g, '')         // Twilio crashes on >
        .replace(/"/g, '')         // Remove double quotes which can break TwiML attributes
        .replace(/'/g, '');
      console.log(`[Sanitized for Twilio]: ${aiResponse}`);

      // Loop the conversation back by using <Gather> again!
      const twiml = `
        <Response>
          <Gather input="speech" action="/voice/process-speech" timeout="5" speechTimeout="auto">
            <Say voice="alice">${aiResponse}. What else can I help you with?</Say>
          </Gather>
        </Response>
      `;
      return res.status(200).send(twiml);

    } catch (error) {
      console.error('Voice routing error:', error);
      return res.status(200).send(`
        <Response>
          <Say voice="alice">Sorry, our system is experiencing technical difficulties. Connecting you to an agent.</Say>
          <!-- You could put your <Dial> command here to route to a human! -->
        </Response>
      `);
    }
  }
}