import { Controller, Post, Req, Res, Header, Body } from '@nestjs/common';
import { Request, Response } from 'express';
import { SalesforceService } from '../salesforce/salesforce.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Twilio } from 'twilio';

interface ChatSession {
  state: 'MAIN_MENU' | 'AWAITING_ORDER_SELECTION' | 'AWAITING_AREA' | 'AI_CHAT' | 'AI_CHAT_OR_HANDOFF' | 'AWAITING_LANGUAGE';
  customerContext?: any; 
  selectedOrderContext?: any; // To store which specific order they selected
  selectedAreaSkillId?: string;
  selectedAreaName?: string;
}

@Controller('whatsapp')
export class WhatsappController {
  private redisClient: Redis;
  private genAI: GoogleGenerativeAI;
  private twilioClient: Twilio;

  constructor(
    private readonly sfService: SalesforceService,
    private readonly configService: ConfigService
  ) {
    // Initialize Redis & Gemini on boot
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error('REDIS_URL must be configured');
    }
    this.redisClient = new Redis(redisUrl);

    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY must be configured');
    }
    this.genAI = new GoogleGenerativeAI(geminiApiKey);

    // Initialize Twilio
    this.twilioClient = new Twilio(
      this.configService.get<string>('TW_ACCOUNT_SID'),
      this.configService.get<string>('TW_AUTH_TOKEN')
    );
  }

  @Post('inbound')
  @Header('Content-Type', 'text/xml')
  async handleIncomingMessage(@Req() req: Request, @Res() res: Response) {
    const fromPhone = req.body.From.replace('whatsapp:', '');
    const messageBody = req.body.Body.trim().toLowerCase();
    
    // 1. Fetch Session from Redis (Default to MAIN_MENU if empty)
    const sessionData = await this.redisClient.get(fromPhone);
    let session: ChatSession | null = sessionData ? JSON.parse(sessionData) : { state: 'MAIN_MENU' };
    let replyText = '';

    // 2. The State Machine
    switch (session?.state) {
      
     case 'MAIN_MENU':
        const customerData = await this.sfService.findCustomerByPhone(fromPhone);
        
        if (customerData && customerData.recentOrders.length > 0) {
            session.customerContext = customerData;
            
            // Dynamically build the menu string based on how many orders they have
            replyText = `Welcome back to Aadhavi Essentials, ${customerData.contactName}! \n\nAre you messaging us about a recent order?\n`;
            
            customerData.recentOrders.forEach((order, index) => {
               replyText += `${index + 1}) ${order.Product_Name__c} (${order.Name})\n`;
            });
            replyText += `${customerData.recentOrders.length + 1}) Other / General Inquiry`;

            session.state = 'AWAITING_ORDER_SELECTION';
            
        } else {
             // Fallback for strangers or people with no orders
             replyText = `Welcome to Aadhavi Essentials!\n\nWhich area do you need support with today?\n1) Product\n2) Payments\n3) Business Integrations`;
             session.state = 'AWAITING_AREA';
        }
        break;

      case 'AWAITING_ORDER_SELECTION':
        const selectedIndex = parseInt(messageBody) - 1;
        const recentOrders = session.customerContext.recentOrders;

        if (selectedIndex >= 0 && selectedIndex < recentOrders.length) {
            // They picked a specific order. Save it to the session.
            session.selectedOrderContext = recentOrders[selectedIndex];
            replyText = `Got it. You are asking about the ${session.selectedOrderContext.Product_Name__c}.\n\n`;
        } else if (selectedIndex === recentOrders.length) {
            // They picked "Other / General Inquiry"
            replyText = `No problem.\n\n`;
        } else {
            replyText = `Invalid selection. Please enter a valid number.`;
            break;
        }

        replyText += `Which area do you need support with?\n1) Product Details\n2) Payments/Billing\n3) Shipping/Tracking`;
        session.state = 'AWAITING_AREA';
        break;

      case 'AWAITING_AREA':
        if (messageBody === '1') {
            session.selectedAreaSkillId = this.configService.get('SF_SKILL_PRODUCT') || '';
            session.selectedAreaName = 'Product';
        } else if (messageBody === '2') {
            session.selectedAreaSkillId = this.configService.get('SF_SKILL_PAYMENTS') || '';
            session.selectedAreaName = 'Payments';
        } else if (messageBody === '3') {
            session.selectedAreaSkillId = this.configService.get('SF_SKILL_BIZ') || '';
            session.selectedAreaName = 'Business Integrations';
        } else {
            replyText = `Invalid selection. Please reply with 1, 2, or 3.`;
            break;
        }
        replyText = `You selected ${session.selectedAreaName}. I am your Aadhavi essentials AI assistant. What is your specific question?`;
        session.state = 'AI_CHAT';
        break;

      case 'AI_CHAT':
        // Generate the AI Response
        replyText = await this.generateAIResponse(session.selectedAreaName, messageBody, session.customerContext);
        
        // Append the Handoff Menu
        replyText += `\n\nHow would you like to proceed?\n1) Ask another question\n2) Chat with an Executive\n3) Main Menu`;
        session.state = 'AI_CHAT_OR_HANDOFF';
        break;

      case 'AI_CHAT_OR_HANDOFF':
        if (messageBody === '1') {
          replyText = `I'm listening. What else would you like to know?`;
          session.state = 'AI_CHAT';
        } else if (messageBody === '2') {
          replyText = `I will transfer you to a human executive. What is your preferred language?\n1) Tamil\n2) English`;
          session.state = 'AWAITING_LANGUAGE';
        } else if (messageBody === '3') {
          replyText = `Returning to Main Menu...\n1) Product\n2) Payments\n3) Business Integrations`;
          session.state = 'AWAITING_AREA';
        } else {
          replyText = `Please reply with 1 (Ask more), 2 (Executive), or 3 (Menu).`;
        }
        break;

      case 'AWAITING_LANGUAGE':
        let languageSkillId = '';
        if (messageBody === '1' || messageBody.includes('tamil')) {
            languageSkillId = this.configService.get('SF_SKILL_TAMIL') || '';
        } else {
            languageSkillId = this.configService.get('SF_SKILL_ENGLISH') || '';
        }

        // Trigger Salesforce SBR with multiple skills
        const requiredSkills = [session.selectedAreaSkillId, languageSkillId].filter((skill): skill is string => !!skill);
        this.sfService.routeWhatsAppCase(fromPhone, 'Customer escalated from AI Chatbot', requiredSkills).catch(console.error);

        replyText = `Thank you. I have transferred your chat. Our Support specialist will assist you shortly.`;
        
        // Wipe the Redis session so they start fresh next time they text
        await this.redisClient.del(fromPhone);
        session = null; 
        break;
    }

    // 3. Save State to Redis (if session wasn't deleted), expiring in 1 hour
    if (session) {
        await this.redisClient.set(fromPhone, JSON.stringify(session), 'EX', 3600);
    }

    // 4. Send TwiML Response
    const twiml = `
      <Response>
        <Message>${replyText}</Message>
      </Response>
    `;
    res.status(200).send(twiml);
  }

  // Helper method to talk to Google Gemini
  // 1. Update the signature to accept the context
  private async generateAIResponse(area: any, customerQuestion: string, context?: any): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      // 2. Dynamically build the context string
      let contextString = "The customer is unknown.";
      if (context && context.Name) {
          contextString = `The customer's name is ${context.Name}. `;
          if (context.Last_Purchase__c) {
              contextString += `They recently purchased: ${context.Last_Purchase__c}. If relevant, you may mention this.`;
          }
      }

      const prompt = `You are an expert, friendly customer support AI for Aadhavi Essentials. 
      We manufacture and sell premium baby wear using high-quality muslin fabrics.
      
      Context regarding this user: ${contextString}
      
      The customer is currently inquiring about our ${area} department.
      Customer's question: "${customerQuestion}"
      
      Provide a warm, concise, and helpful answer in 2 to 3 sentences maximum. Address the customer by name if you know it. Do not ask follow up questions.`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
        console.error('AI Generation Error:', error);
        return "I'm having trouble connecting to my knowledge base right now, but I'm still here to help.";
    }
  }

  @Post('outbound/order-status')
  async handleOutboundShipping(@Body() body: any, @Res() res: Response) {
    try {
      // Salesforce will send us the customer's phone and order number in the JSON body
      const { phoneNumber, orderNumber, productName, orderStatus } = body;

      // Ensure the number is formatted for Twilio's WhatsApp API
      const formattedPhone = phoneNumber?.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`;
      const fromSandbox = this.configService.get<string>('TW_WHATSAPP_NUMBER');

      // Use Twilio REST API to push the proactive message
      const message = await this.twilioClient.messages.create({
        body: `*Aadhavi Essentials Update* 🚚\n\nGreat news! Your ${productName} (Order ${orderNumber}) has just ${orderStatus}. Reply to this message if you need any support!`,
        from: fromSandbox,
        to: formattedPhone
      });

      console.log(`Proactive WhatsApp sent successfully. SID: ${message.sid}`);
      res.status(200).send({ success: true, messageSid: message.sid });

    } catch (error) {
      console.error('Failed to send outbound WhatsApp:', error);
      res.status(500).send({ success: false, error: error.message });
    }
  }

  // BRAND NEW: The Agent Reply Endpoint
  @Post('agent-reply')
  async handleAgentReply(@Body() body: any, @Res() res: Response) {
    try {
      // Salesforce will send us the customer's phone and what the agent typed
      const { phoneNumber, messageText } = body;

      const formattedPhone = phoneNumber?.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`;
      const fromSandbox = this.configService.get<string>('TW_WHATSAPP_NUMBER');

      // Use Twilio REST API to push the agent's message
      const message = await this.twilioClient.messages.create({
        body: `*Agent Reply:* \n${messageText}`,
        from: fromSandbox,
        to: formattedPhone
      });

      console.log(`Agent reply routed to customer successfully. SID: ${message.sid}`);
      res.status(200).send({ success: true, messageSid: message.sid });

    } catch (error) {
      console.error('Failed to route agent reply:', error);
      res.status(500).send({ success: false, error: error.message });
    }
  }
}