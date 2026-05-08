# Aadhavi Essentials: Enterprise CCaaS Routing Middleware

## 📌 Executive Summary
This repository contains the backend middleware and architectural blueprint for a custom Contact Center as a Service (CCaaS) integration. Designed for Aadhavi Essentials, this system bridges external telecom events (Twilio) with enterprise CRM routing (Salesforce Service Cloud). 

Instead of relying on rigid, out-of-the-box CTI adapters, the Interactive Voice Response (IVR) state machine is decoupled and hosted within a custom NestJS backend. This enables real-time database lookups, dynamic headless authentication, and API-driven Skills-Based Routing (SBR), ensuring customers are instantly connected to the correct product or payment specialist via Omni-Channel.

---

## 🏗️ Architecture & Tech Stack

* **Telecom Edge (Twilio):** Handles the physical telephony, listens for DTMF tones (keypad presses), and executes TwiML (XML) instructions.
* **Orchestration Middleware (NestJS):** The "brain." Normalizes legacy `application/x-www-form-urlencoded` webhook payloads, manages state, and securely interfaces with Salesforce.
* **System of Record (Salesforce):** Executes Skills-Based Routing via the `PendingServiceRouting` and `SkillRequirement` API objects to pop Cases directly onto the agent's Service Console screen.

---

## ⚙️ Execution Plan & Implementation Steps

### Phase 1: Salesforce Infrastructure
1.  **Connected App Setup:** Created an OAuth 2.0 Connected App with `Enable Client Credentials Flow` for secure, server-to-server headless authentication.
2.  **Omni-Channel Configuration:** Enabled Skills-Based Routing (SBR) and created a Service Channel for the `Case` object.
3.  **Skills Mapping:** Created specialized skills (`Tamil`, `English`, `Product`, `Payments`) and assigned them to Service Resources.
4.  **Data Retrieval:** Utilized SOQL via Developer Console / Inspector to map static IDs (Queue IDs, Skill IDs, Service Channel IDs) to the backend `.env`.

### Phase 2: NestJS Middleware
1.  **Security:** Implemented a `SalesforceService` to handle OAuth token generation and caching via HTTP requests.
2.  **Routing Logic:** Orchestrated a 4-step database transaction in Salesforce:
    * Create the `Case` (Work Item).
    * Create the `PendingServiceRouting` (PSR).
    * Create the `SkillRequirement` (Linking user input to specific agent skills).
    * Patch the PSR to `IsReadyForRouting: true` to trigger the Omni-Channel screen pop.
3.  **Twilio Controller:** Built a webhook listener using TwiML `<Gather>` tags to act as a multi-step IVR state machine, collecting language preferences and Customer IDs.

### Phase 3: Telecom Edge & Bridging
1.  **Public Tunnelling:** Exposed the local NestJS server via Ngrok to catch Twilio webhooks.
2.  **Audio Bridging:** Utilized the TwiML `<Dial>` verb to forward the verified caller directly to the Aadhavi executive's physical device once the CRM routing was successful.

---

## 🛑 Real-World Challenges & Architectural Solutions
*Note for Interviews: These represent actual integration hurdles encountered and solved during the PoC phase.*

### 1. Headless Authentication Rejection
* **Issue:** Salesforce API returned `400 Bad Request` with `error_description: 'no client credentials user enabled'` during the OAuth handshake.
* **Root Cause:** The Client Credentials flow lacks a human UI, so Salesforce did not know which user profile's permissions to apply to the API transactions.
* **Solution:** Navigated to the Connected App's "Edit Policies" section and explicitly assigned a "Run As" execution user.

### 2. TwiML `<Dial>` Call Drops
* **Issue:** The IVR successfully captured inputs and routed the Salesforce Case, but instantly dropped the call when attempting to bridge the audio to the executive's mobile phone.
* **Root Cause A (Trial Restrictions):** Twilio trial accounts strictly prohibit spoofing Caller IDs. The `<Dial>` verb defaulted to passing the customer's phone number, triggering the anti-spam firewall.
* **Root Cause B (Geo-Permissions):** Default Twilio security blocks outbound international dialing (e.g., to India `+91`).
* **Solution:** Added the `callerId` attribute to the `<Dial>` verb, hardcoding it to the verified Twilio `+1` number. Simultaneously updated Twilio's Voice Geographic Permissions to allow outbound connections to India.

### 3. Dynamic SOQL Targeting
* **Issue:** Querying `SELECT Id FROM ServiceChannel WHERE DeveloperName = 'Case'` returned empty results.
* **Root Cause:** Salesforce auto-generates Developer Names based on the arbitrary human label provided during creation (e.g., `Aadhavi_Support_Channel`), not the underlying routed object.
* **Solution:** Broadened the SOQL query to `SELECT Id, MasterLabel, DeveloperName FROM ServiceChannel` to dynamically identify the correct system-generated Developer Name for mapping.

---

## 🚀 Scalability & Next Steps
Because the routing engine is completely decoupled from the telecom provider, this architecture is primed for true omnichannel expansion. Future iterations can easily route WhatsApp JSON payloads through the exact same `SalesforceService` logic, normalizing diverse incoming data into a single, unified Omni-Channel agent experience.
