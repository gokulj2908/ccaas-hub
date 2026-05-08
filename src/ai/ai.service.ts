import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateReply(userSpeech: string, customerRecord: any): Promise<string> {
    try {
      // 1. We use Gemini 1.5 Flash - it is the fastest model, crucial for Voice IVR latency
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      console.log('Customer Record from Salesforce:', customerRecord);
      // 2. Safely parse the Salesforce data
      const customerName = customerRecord?.contactName || 'Valued Customer';
    

      // 3. The Enterprise System Prompt
      // This is where you instruct the AI on its persona and constraints
     const systemInstruction = `
        You are 'Aadhavi', the friendly and professional AI Voice Assistant for 'Aadhavi Essentials' (a premium baby wear brand).
        
        CURRENT CONTEXT:
        - Customer Name: ${customerName}

        COMPANY KNOWLEDGE BASE (Products we sell):
        - Premium Muslin Swaddle Sets
        - Organic Bamboo Baby Wraps
        - Newborn Cotton Starter Kits
        - Breathable Sleep Sacks

        VOICE IVR CONSTRAINTS (STRICT):
        1. You are speaking out loud over a phone call. Keep responses conversational and under 2 sentences.
        2. DO NOT use formatting, asterisks, bullet points, numbers, or special characters. Speak in plain text paragraphs only.
        3. ALWAYS provide a complete, helpful sentence.
        4. If asked about our products, casually mention 2 or 3 items from the Knowledge Base in a natural spoken sentence.
        5. If they ask to speak to a human, exactly reply: "I will connect you to an executive now."
      `;

      // 4. Execute the Call
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userSpeech }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
        generationConfig: {
            temperature: 0.6, // Keep it professional and predictable
            maxOutputTokens: 200 // Force brief responses
        }
      });

      const aiText = result.response.text();
      
      this.logger.log(`Generated AI Reply for ${customerName}`);
      return aiText;

    } catch (error) {
      this.logger.error('Failed to generate AI reply:', error);
      return "I'm sorry, I'm having trouble accessing that information right now. Let me connect you to an executive.";
    }
  }
}