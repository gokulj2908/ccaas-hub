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