import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as qs from 'qs';

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);
  private accessToken: string | null = null;
  private readonly sfDomain: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly caseChannelId: string;
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.sfDomain = this.configService.get<string>('SF_DOMAIN') || '';
    this.clientId = this.configService.get<string>('SF_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('SF_CLIENT_SECRET') || '';
    this.caseChannelId = this.configService.get<string>('SF_CHANNEL_CASE') || '';
  }

  async authenticate(): Promise<void> {
    this.logger.log('Authenticating via Client Credentials...');
    const tokenUrl = `${this.sfDomain}/services/oauth2/token`;
    const payload = qs.stringify({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(tokenUrl, payload, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      );
      this.accessToken = response.data.access_token;
      this.logger.log('Token successfully cached.');
    } catch (error) {
      this.logger.error('Authentication Failed', error.response?.data);
      throw error;
    }
  }

  async routeAadhaviCall(phoneNumber: string, skillId: string, customerId: string): Promise<void> {
    if (!this.accessToken) await this.authenticate();

    try {
      // 1. Create the Case
      const casePayload = {
        Subject: 'Inbound Aadhavi Customer Call',
        Description: `Customer ID entered in IVR: ${customerId}`,
        Origin: 'Phone',
        SuppliedPhone: phoneNumber,
      };
      const caseRes = await this.sfRequest('POST', '/services/data/v60.0/sobjects/Case', casePayload);
      const caseId = caseRes.id;

      // 2. Create the Routing Request (PSR)
      const psrPayload = {
        CapacityWeight: 1,
        IsReadyForRouting: false,
        RoutingModel: 'MostAvailable',
        RoutingPriority: 1,
        RoutingType: 'SkillsBased',
        ServiceChannelId: this.caseChannelId,
        WorkItemId: caseId,
      };
      const psrRes = await this.sfRequest('POST', '/services/data/v60.0/sobjects/PendingServiceRouting', psrPayload);
      const psrId = psrRes.id;

      // 3. Attach the Skill Requirement
      await this.sfRequest('POST', '/services/data/v60.0/sobjects/SkillRequirement', {
        RelatedRecordId: psrId,
        SkillId: skillId,
        SkillLevel: 5,
      });

      // 4. Release to Omni-Channel
      await this.sfRequest('PATCH', `/services/data/v60.0/sobjects/PendingServiceRouting/${psrId}`, {
        IsReadyForRouting: true,
      });
      
      this.logger.log(`Call pushed to Omni-Channel SBR engine successfully.`);
      return caseId;
    } catch (error) {
      if (error.response?.status === 401) {
        this.accessToken = null;
        await this.authenticate();
        return this.routeAadhaviCall(phoneNumber, skillId, customerId);
      }
      this.logger.error('Routing Failed', error.response?.data);
    }
  }

  async attachRecordingToCase(caseId: string, recordingUrl: string): Promise<void> {
    if (!this.accessToken) await this.authenticate();
    try {
      // We append .mp3 so the browser can play it natively
      const fullAudioUrl = `${recordingUrl}.mp3`; 
      
      await this.sfRequest('PATCH', `/services/data/v60.0/sobjects/Case/${caseId}`, {
        Call_Recording_URL__c: fullAudioUrl,
      });
      
      this.logger.log(`Successfully attached audio recording to Case: ${caseId}`);
    } catch (error) {
      this.logger.error(`Failed to attach recording to Case ${caseId}`, error.response?.data);
    }
  }

  private async sfRequest(method: 'POST' | 'PATCH' | 'GET', endpoint: string, data?: any) {
    const url = `${this.sfDomain}${endpoint}`;
    const response = await firstValueFrom(
      this.httpService.request({
        method, url, data, headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      })
    );
    return response.data;
  }

  //whatsapp
 // 1. Change skillId: string to skillIds: string[]
  async routeWhatsAppCase(sender: string, messageBody: string, skillIds: string[]): Promise<string> {
    if (!this.accessToken) await this.authenticate();

    try {
      const casePayload = {
        Subject: `WhatsApp Inquiry from ${sender}`,
        Description: `Customer Message: ${messageBody}`,
        Origin: 'Web',
        SuppliedPhone: sender,
      };

      const caseRes = await this.sfRequest('POST', '/services/data/v60.0/sobjects/Case', casePayload);
      const caseId = caseRes.id;

      const psrRes = await this.sfRequest('POST', '/services/data/v60.0/sobjects/PendingServiceRouting', {
        CapacityWeight: 1,
        IsReadyForRouting: false,
        RoutingModel: 'MostAvailable',
        RoutingPriority: 1,
        RoutingType: 'SkillsBased',
        ServiceChannelId: this.caseChannelId,
        WorkItemId: caseId,
      });
      const psrId = psrRes.id;

      // 2. Loop through the array and attach ALL required skills
      for (const skillId of skillIds) {
        if (skillId) {
          await this.sfRequest('POST', '/services/data/v60.0/sobjects/SkillRequirement', {
            RelatedRecordId: psrId,
            SkillId: skillId,
            SkillLevel: 5,
          });
        }
      }

      await this.sfRequest('PATCH', `/services/data/v60.0/sobjects/PendingServiceRouting/${psrId}`, {
        IsReadyForRouting: true,
      });
      
      this.logger.log(`WhatsApp message pushed to Omni-Channel with ${skillIds.length} skills.`);
      return caseId;

    } catch (error) {
      this.logger.error('Failed to route WhatsApp Case', error.response?.data);
      throw error;
    }
  }

  // findcustomerByPhone
  async findCustomerByPhone(phoneNumber: string): Promise<any> {
    if (!this.accessToken) await this.authenticate();

    try {
      // The Parent-to-Child Subquery
      // We grab the Contact Name, and a sublist of their 3 most recent Aadhavi Orders
      const query = `
        SELECT Id, Name, 
          (SELECT Id, Name, Product_Name__c, Status__c FROM Aadhavi_Orders__r ORDER BY CreatedDate DESC LIMIT 3) 
        FROM Contact 
        WHERE Phone = '${phoneNumber}' 
        LIMIT 1
      `;
      
      const encodedQuery = encodeURIComponent(query.replace(/\s+/g, ' ').trim());
      const response = await this.sfRequest('GET', `/services/data/v60.0/query/?q=${encodedQuery}`);
      
      if (response.records && response.records.length > 0) {
        const contact = response.records[0];
        // Safely extract the nested orders array, if they have any
        const orders = contact.Aadhavi_Orders__r ? contact.Aadhavi_Orders__r.records : [];
        
        return {
           contactName: contact.Name,
           recentOrders: orders
        };
      }
      return null;
      
    } catch (error) {
      this.logger.error('Data Dip Failed', error.response?.data);
      return null;
    }
  }
}