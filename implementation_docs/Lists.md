## Salesforce SBR and Twilio call to case creation
1. Created few skills in salesforce service cloud and assigned the skills to service resources
2. Turned on the omni-channel and status to available
3. When customer call twilio, we gather inputs and at last after choosing skills, the case is created and call gets ended.
4. Agent number added, outbound calls from twillio -> saved the recording in the salesforce respective caseId.

## Whatsapp to Case creation
1. Integrated AI (Google studio), and tried to provide resolution to queries directly
2. Still the user needs support, capture the inputs and create the case to particular skills service support

## Redis for cache - session maintanence.
1. To achieve the continuous chat, we need to maintain the particular user session. We used redis for achieving this

## Salesforce marketing cloud to whatsapp
1. Now by using phone number, we can get to know the user details if we maintained them in our org contacts. (Nest BE acts registered as external services)
2. By using the details, as ecommerce platform we are asking them for last 3 orders support by default, or any other.
3. Based on above selection the switch case will behave.

## Notifications to whatsapp (Order status)
1. When agent change the status to processing -> Shipped or -> Delivered, the customer will get notification in whatsapp
2. Achieved the above using salesforce flows -> record trigerred flow. 
3. Action is -> Create http callout 

## 1 REPLY from agent (Need to scale)
1. Used screen flow to place one box in case details page layout.
2. Once case is taken, agent can reply to customer query using that. But it is not dynamic

## AI calls
1. Now like whatsapp, we try to record customer's query -> convert to text -> process with AI -> text to speech -> reply to customer on query
2. Based on phone number, we also use user details here and use them accordingly in responses.

## Buy Method Licenses (SCV + AWS Connect) (NO code)
1. Refer P4 and P4.1 Interview Explanations

## Amazon Connect 
1. Youtube: Tech with Kobina (https://www.youtube.com/playlist?list=PLY48RGnTWqFE2BLAnaXp1aaNigHjQLQN2)
2. User email: gokul.j@tonyshive.com
3. Password: Gokul@6991
4. Instance: https://aadhavi-support.my.connect.aws/
5. Instance admin: gokul__j and same password as above
6. **AWS** AccId: 558215002953 
7. **AWS** AccName: Go Cool CX 

# How to use Amazon connect in India
1. AWS does not sell +91 numbers out of the box to standard retail accounts.
2. To use Amazon Connect legally and successfully for an Indian business, you must follow the industry-standard enterprise pattern.
3. Most Indian startups bypass this by using an AWS Partner / Managed Service Provider (MSP) in India (like Tata Communications, Minfy, or multi-cloud vendors).
4. Since AWS cannot sell you +91 phone numbers directly due to TRAI regulations, you must source your Indian phone numbers from a licensed local telecom carrier.
5. You purchase your business phone numbers (Local DIDs or a 1800 Toll-Free number) directly from Tata Communications, Airtel Business, or Jio.
6. Wire the Logic for your E-Commerce Flow: Once your carrier bridges the numbers into your Connect instance, the telephony acts exactly like the tests you ran earlier. You can build a direct-to-queue e-commerce loop using AWS Lambda function.

# Companies and their tools (Important)
1. Ahaa OTT: Salesforce CRM + Amazon connect customer
2. Elite insurance partners: Salesforce Service and marketing cloud + Five9
3. Cookd: Freshchat, Moengage and clevertap (Notifications and messaging channels)
4. Nexkauf: Native API + Amazon connect Customer (Duplicates Aadhavi CCaaS hub)
5. Niva Bupa: Sprinklr
