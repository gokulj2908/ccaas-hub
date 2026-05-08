## Requirement: 
Lets start AI conversational chats with whatsapp itself.

My requirement: I have 5 skills ( 2 languages + 3 area specialist skills with respective ids in .env)

Now when customer texting us, ask them the which area they need support ?

- 1) Product

- 2) Payments

- 3) Business Integrations

when selecting anyone from above, AI agent will answer shortly but on ending it should ask Yes to continue with AI or chat with executive, back to main menu - to again change area etc..

when chat with executive clicked, select language and procees according to skills.

---------------------------------------------------------------------------------------------------------

# Aadhavi Essentials: Omnichannel WhatsApp & AI Deflection Architecture

## 📌 Phase 3 Executive Summary
This document outlines the Phase 3 evolution of the Aadhavi Essentials CCaaS middleware. Moving beyond static voice routing, the system now incorporates text-based Omnichannel capabilities via WhatsApp, integrated with a Level-1 Conversational AI (Google Gemini) and a serverless Redis state machine (Upstash).

This architecture implements a highly scalable **Deflection & Escalation** model. The NestJS middleware acts as an intelligent traffic cop, utilizing an AI chatbot to resolve tier-one customer inquiries regarding products, payments, and business integrations. The system only triggers the expensive CRM API payload (Salesforce Omni-Channel routing) when a customer explicitly requests human escalation, ensuring human agents are reserved for high-value interactions.

---

## 🏗️ Architectural Enhancements

* **Omnichannel Normalization Layer:** The NestJS controller seamlessly accepts URL-encoded Twilio WhatsApp payloads, normalizing vendor-specific data (`whatsapp:+91...`) into standard E.164 phone numbers before CRM insertion.
* **Stateless Session Management:** Transitioned from localized variables to a serverless Redis memory store. This allows the backend to track user states (Menus vs. AI Chat) across multiple asynchronous webhooks, enabling horizontal scaling across load balancers.
* **Context-Aware Conversational AI:** Integrated the Google Gemini API. The LLM is injected with strict system prompts enforcing the Aadhavi Essentials brand voice and domain expertise (e.g., muslin fabrics, GSM, Tiruppur/Erode textile sourcing) for highly accurate, bounded responses.
* **Multi-Dimensional Skills-Based Routing (SBR):** Refactored the Salesforce service to accept and iterate through an array of Skill IDs, routing the escalated chat based on both the selected **Department Area** and the customer's **Language Preference**.

---

## ⚙️ Implementation Steps

### 1. Edge & State Infrastructure
* Configured the Twilio WhatsApp Sandbox to point inbound messages to the NestJS `/whatsapp/inbound` endpoint.
* Provisioned an Upstash Redis database and Google Gemini API keys, binding them to the NestJS environment variables.

### 2. NestJS State Machine Controller
* Implemented a `switch/case` architecture based on the Redis session state:
    * `MAIN_MENU`: Captures the initial inbound text.
    * `AWAITING_AREA`: Maps the department selection to specific Salesforce Skill IDs.
    * `AI_CHAT`: Passes the user's intent to Gemini and returns the AI-generated context.
    * `AI_CHAT_OR_HANDOFF`: Provides the escape hatch for human escalation.
    * `AWAITING_LANGUAGE`: Captures the final routing variable and executes the CRM API payload.

### 3. Salesforce Multi-Skill Orchestration
* Modified `routeWhatsAppCase` to handle an array of `skillIds`.
* Implemented a `for...of` loop to dynamically attach multiple `SkillRequirement` records to a single `PendingServiceRouting` (PSR) request, ensuring the target agent possesses all necessary attributes.

---

## 🛑 Real-World Challenges & Architectural Solutions
*Note for Interviews: These represent actual hurdles encountered during the Omnichannel AI implementation.*

### 1. Data Normalization (The Prefix Problem)
* **Issue:** Twilio's unified messaging API automatically prepended `whatsapp:` to the caller ID, polluting the Salesforce `SuppliedPhone` field and breaking native click-to-dial functionality.
* **Solution:** Implemented a string manipulation layer (`req.body.From.replace('whatsapp:', '')`) immediately upon webhook receipt, scrubbing vendor-specific formatting to maintain a pristine CRM database.

### 2. Handling Asynchronous State (The State Machine)
* **Issue:** Webhooks are inherently stateless. A standard Node.js server forgets the customer the moment the HTTP response is sent, making conversational menus impossible.
* **Solution:** Introduced Redis. NestJS queries Upstash using the customer's phone number as the key upon every webhook, retrieves the user's place in the menu architecture, and applies a TTL (Time To Live) to auto-expire stale sessions.

### 3. Strict Type Safety & Memory Wipes
* **Issue:** The TypeScript compiler threw `Type 'null' is not assignable to type 'ChatSession'` when attempting to clear the user's session after a successful human handoff.
* **Root Cause:** NestJS enforces strict null checks, preventing runtime exceptions.
* **Solution:** Explicitly defined the session variable with a Union Type (`let session: ChatSession | null`), satisfying the compiler while securely wiping the session memory before terminating the execution block.