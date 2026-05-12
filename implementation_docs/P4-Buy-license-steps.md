# Salesforce Voice & Amazon Connect Demo

## Create a temporary Service cloud voice trailhead organization

**Why:** Service Cloud Voice is not just a standard Salesforce feature; it's a deeply integrated architecture that requires a specific add-on license. This license doesn't just unlock metadata in Salesforce (like the Contact Center objects and Voice Call routing); it actually triggers a background provisioning process that spins up and links an AWS Amazon Connect instance to the Salesforce Org. Standard Developer orgs simply do not have the licensing tier to authorize the AWS resource creation.

# Phase 1: Omni-Channel Foundation

## Phase 1: Task 1 -  Create 2 sample queues (Ecommerce examples)

* Voice Sales
* Voice Support 

### How to create queues:
* Go to Setup and search for Queues.
* Click New.
* For the first queue, label it Voice Sales.
* In the Supported Objects section, find and add `Voice Call.` (This is critical—without this, the queue won't "see" phone calls).
* Add yourself (your User) as a Queue Member.
* Repeat for Voice Support.

## Phase 1: Task 2 - Creating a routing configuration
A Routing Configuration tells Salesforce how to prioritize work and how much "weight" a phone call has compared to an agent's total capacity.
`Create one Routing Configuration that will be shared by both queues.`

* In Setup, search for `Routing Configurations.`
* Click New.
* Fill in the Name and Developer Name as Voice Routing.
* Set Routing Priority to 1.
* Set Routing Model to Most Available.
* Under Capacity Weight, enter 5.
* Click Save.
* CRITICAL FINAL STEP: Go back to your Queues (Voice Sales and Voice Support), click Edit, and in the Routing Configuration look-up field, select the Voice Routing you just created.

## Phase 1: Task 3 - The Presence Status & Agent Access
A Presence Status is the button the agent clicks in the Omni-Channel widget to say, "Send me work!" But Salesforce security requires us to not only create the status but also explicitly grant your user profile permission to see it.

    Create an "Available" status specifically for voice calls, and grant your System Administrator profile access to use it.

* In Setup, search for `Presence Statuses.`
* Click New.
* Status Name: Available - Voice.
* Status Options: Select Online.
* `Selected Channels:` In the Available Service Channels list, find `Phone` (or it might be called Voice Call depending on the sandbox version) and move it to the Selected box. Click Save.
* Now, grant yourself access: In Setup, search for `Profiles.`
* Click on your profile (System Administrator).
* Hover over or scroll down to the related list called Service Presence Statuses Access and click Edit.
* Move Available - Voice from the Available box to the Enabled box.
* Click Save.

### Here is the exact architectural flow of how Omni-Channel connects a Queue to a Presence Status:

* **The Object:** A phone rings. Salesforce creates a Voice Call record.

* **The Queue:** The system drops that Voice Call into your Voice Sales Queue.

* **The Service Channel (The Glue):** Behind the scenes, Salesforce maps the Voice Call object to a specific Service Channel (usually named "Phone" or "Voice").

* **The Presence Status:** Remember when we created the Available - Voice status and you selected "Phone" from the available channels? You essentially told the system: "When I use this status, turn on my 'Phone' Service Channel."

* **The Match (The Engine):** Omni-Channel constantly runs a matching engine. It looks at you and says:

    * "Is Gokul a member of a Queue that handles 'Phone' work? Yes, the Voice Sales queue."

    * "Is Gokul currently in a Presence Status that accepts 'Phone' work? Yes, he just clicked 'Available - Voice'."

    * "Does Gokul have enough Capacity Weight available? Yes."

    * **Result:** The system pushes the Work Item to your screen.

`If you are in a status like "Available - Chat," Omni-Channel sees that Chat does not match the Voice Queue's supported object, so the phone call sits in the queue and waits.`

# Phase 2: The AWS & Telephony Bridge

## Phase 2: Task 1 - Accessing the Contact Center & Adding Users

**Task:**
Locate the auto-provisioned Contact Center in your org and add yourself to it so your Omni-Channel widget can physically connect to AWS.

* Navigated to Amazon Setup and flipped the master Service Cloud Voice toggle to ON.
* Attempted to unhide the menu by assigning the Contact Center Admin Permission Set to your user and performing a hard logout/login to clear the cache.
* When the menu remained hidden, audited Company Information > Permission Set Licenses to verify the environment actually held the required AWS infrastructure licenses.
* Identified that the standard playground only had "Voice User" licenses, so we migrated to a dedicated SCV Developer Edition Org.
* Triggered the Contact Center build, but received an AWS error email regarding missing identity verification.
* Navigated to Identity Provider in Setup and clicked Enable (generating a self-signed certificate) to establish the necessary SSO trust between Salesforce and AWS.
* Returned to Amazon Setup, successfully clicked New under Contact Centers, and entered the Display Name and AWS Region to launch the automated Amazon Connect infrastructure build.

## Phase 2: Task 2 - The Identity Sync
Now that the Contact Center exists, we must link your Salesforce user to it.

* In the Setup Quick Find box, search for 'Contact Centers.'
* Click on the name of your newly created Demo Contact Center.
* Scroll down to the related list called Contact Center Users.
* Click Add.
* Search for your 'User record'.
* Under Contact Center Role, select Contact Center Admin.
* Click Save.

## Phase 2: Task 3 — Exposing the Softphone (Omni-Channel Widget)
Right now, the telephony engine is running, but you have no way to access it. We need to add the Omni-Channel utility to your Service Console so you can log in and trigger the SSO handshake we built earlier.

* In the Setup Quick Find box, search for App Manager.
* Locate the `app named Service Console` (make sure it's the Lightning version). Click the dropdown arrow on the far right and select Edit.
* In the left-hand navigation menu of the App Builder, click Utility Items (Desktop Only).
* Click Add Utility Item and search for Omni-Channel. Select it.
* Click Save at the bottom, then click the back arrow at the top left to exit the App Builder.
* Now, click the App Launcher (the 3x3 grid of dots at the top left of Salesforce), search for Service Console, and open it.
* Look at the very bottom left of your screen. Click the Omni-Channel text to pop open the widget.
* You might see a popup asking to allow microphone access—be sure to click Allow! (Can turn it on in omni channel settings - utility item)

`Why use an embedded softphone instead of letting agents use a separate Amazon Connect browser tab?`
    **The core value of Service Cloud Voice is the 'Single Pane of Glass' agent experience. By embedding the telephony controls directly into the Salesforce utility bar via the CTI (Computer Telephony Integration) architecture, we eliminate context switching. Agents don't have to toggle between tabs to answer a call and look up customer data. This drastically reduces Average Handle Time (AHT) and ensures that the moment a call connects, the relevant CRM data can be automatically popped onto their screen.**

# Phase 3: Intelligent Routing & Flow.
Right now, you have a softphone, but no phone number to call, and no IVR (Interactive Voice Response) to answer the phone.

To configure the actual telecom side of this architecture, we have to cross the bridge into AWS.

## Phase 3: Task 1 - Crossing into AWS & Claiming a Phone Number

Use Salesforce SSO to log into the backend Amazon Connect instance and claim a physical phone number for your demo.

* Go to setup -> Amazon Contact Centers
* Click the contact center available
* Click the `Telephony Provider Settings`
* It will open the `amazon connect instance in new window`
* In left side bar, choose channels -> Phone number
* Click Clain a number
* Choose DID or toll free and select available country (US) and pick available number
* For now, leave the "Flow / IVR" mapped to the default *Sample inbound flow (first contact experience)*
* Click Save 

## Phase 3: Task 2 — Replicating the Queues in AWS
Perfect. You now have a public endpoint where the outside world can reach your architecture.

However, right now, AWS and Salesforce have a language barrier. You have buckets (Queues) in Salesforce called Voice Sales and Voice Support, but AWS has no idea they exist. In a decoupled integration architecture—much like mapping a frontend interface to a backend NestJS service—we need to create matching endpoints on the backend so the two systems can pass the payload (the phone call) seamlessly.

**We need to create the corresponding Queues in Amazon Connect and assign them to your AWS user profile so the telephony engine knows you are allowed to receive calls from them.**

* Keep your Amazon Connect tab open. On the left-hand menu, go to Routing -> Queues.
* Click the Add queue button.
* Name: Voice Sales
* Hours of operation: Select Basic Hours (or whatever default exists).
* Outbound caller ID number: Select your new +1 877-424-9854 number.
* Click Save.
* Repeat steps 2-6 to create the Voice Support queue.
* Next, on the left-hand menu, go to Users -> Routing profiles.
* Click into the default profile you are assigned to (usually named Basic Routing Profile).
* Scroll down to the Queues section and click Add queue or the dropdown to add both Voice Sales and Voice Support.
* Set their priority and delay to the default (Priority 1, Delay 0), and make sure the "Channels" icon for Voice (the phone receiver) is checked.
* Click Save at the top right.

### Amazon Connect (The Audio Engine)
Amazon Connect’s only job is to manage the raw, physical telecom connection. It holds the actual audio stream (the SIP trunk/RTP media).

* **AWS Queues:** Think of these as Acoustic Holding Pens. When a customer calls, the physical audio connection has to wait somewhere while hold music plays. Salesforce cannot stream audio, so AWS holds the call in an AWS Queue.

* **AWS Routing Profiles:** Think of this as the Hardware Permission. It tells the telecom carrier, "This specific user’s headset is physically allowed to receive audio from these holding pens."

### The process flows like this:

* A call comes into the AWS Queue (Holding the audio).
* AWS asks Salesforce: "Who should get this?"
* Salesforce looks at the Salesforce Queue and Routing Config (Checking capacity and business rules).
* Salesforce says: "Gokul is free. He has capacity."
* Salesforce tells AWS: "Push the audio down the AWS Routing Profile to Gokul's headset."

## Phase 3: Task 3 - The AWS Contact Flow (The IVR)
Create a new Contact Flow in Amazon Connect that greets the caller and gives them a menu option (Press 1 for Sales, Press 2 for Support).

* In the left-hand menu of Amazon Connect, go to Routing -> Flows (or Contact flows).
* Click the Create flow button at the top right (select standard Create flow, not inbound/outbound specifically if it asks).
* At the top left, click the title (usually "Enter a name") and rename it to Demo IVR Routing.
* On the left side of the screen, you will see a menu of "blocks". Open the `Interact` section.
* Drag the Get customer input block onto the blank canvas.
* Draw a line from the "Start" circle to the left side of your new Get customer input block.
* Click the title of the Get customer input block to open its settings on the right.
    * Select Text-to-speech (Ad hoc).
    * Enter the text: Welcome to the demo. Press 1 for Sales, or press 2 for Support.
    * Scroll down to the `DTMF section`. Add two options: 1 and 2.
    * Click Save at the bottom of the properties panel.

## Phase 3: Task 4 — Setting the Destinations
Link the button presses to their respective queues, and then execute the transfer.

* On the left-hand block menu, open the Set category.
* Drag two Set working queue blocks onto your canvas.
* Click the title of the first one. Under the queue dropdown, select your Voice Sales queue. Click Save.
* Click the title of the second one. Under the queue dropdown, select your Voice Support queue. Click Save.
* Now, draw a line connecting the Pressed 1 branch to the Voice Sales block.
* Draw a line connecting the Pressed 2 branch to the Voice Support block.
* Finally, go to the left menu, open the Terminate / Transfer category, and drag a Transfer to queue block onto the canvas.
* Connect the Success branches from both of your "Set working queue" blocks into that single "Transfer to queue" block.
* Click Publish at the top right of the screen. (Not just Save, it must be Published).

`How do you handle error states in CCaaS routing flows?` 
    In telecom architectures, every single node in an IVR must have deterministic error handling. We cannot leave orphaned connections. I always ensure every 'Error', 'Timeout', or 'At Capacity' branch is explicitly routed to a Disconnect block with a polite fallback message. This prevents infinite loops, dead air, and guarantees a graceful degradation of the customer experience if backend routing fails.

### Error Handling Fix
* In the left-hand menu, open the Terminate / Transfer category.
* Drag a single Disconnect block onto your canvas. (You only need one; we will route all errors to it).
* Connect all the remaining unconnected branches from your existing blocks to this single Disconnect block. This includes:

    * From the Get customer input block: Timeout, Default, and Error.
    * From both Set working queue blocks: Error.
    * From the Transfer to queue block: At capacity and Error.
*Once every single branch has a destination, click Publish again.

## Phase 3: Task 5 — Tying the Number to the Logic

Update your claimed phone number so that it triggers your Demo IVR Routing flow when someone dials it.

* In your Amazon Connect tab, hover over the left-hand menu and go to Channels -> Phone numbers.
* Click directly on the +1 877-424-9854 number you claimed earlier.
* Look for the dropdown menu labeled Contact flow / IVR.
* Click it, and change it from the default sample to your newly published Demo IVR Routing.
* Click Save.

## Phase 3: Task 6 — The Queue Mapping (The Missing Link)

Tell Salesforce which AWS queues correspond to your Salesforce queues.

* Go back to your Salesforce tab.
* Navigate to Setup -> Contact Centers -> click on your Demo Contact Center.
* Scroll all the way down to the Queue Mapping related list.
* Click the Add button.
* In the modal, select your Salesforce queue: Voice Sales.
* Select the matching Amazon Connect queue: Voice Sales.
* Click Save.
* Repeat steps 4-7 for Voice Support.

 Now the bridge is fully complete. The AWS audio holding pen is officially glued to the Salesforce data bucket.

`Once you have mapped those two queues, go ahead and trigger the Live Test we set up in Phase 4! Call the number, press 1, and watch your Omni-Channel widget ring`

# Phase 4: The Live Test & Demo Script.

### Blocker: The queue mapping is not done - in salesforce we cannot able to load that 2 available queues and when debugging that the account logged out and cannot able to login after that.

### So I followed the below steps

* In Salesforce Setup, search for Queues and click Edit next to SCV Basic Queue.
* Scroll to the bottom to Queue Members.
* Make sure your User (Gokul) is in the Selected Users list. Click Save.

* **Step 2:** Reroute the AWS IVR
    * Go back to your Amazon Connect tab and open your Demo IVR Routing flow.
    * Click on the Set working queue block that is attached to the "Pressed 1" branch.
    * Change the selected queue from Voice Sales to BasicQueue.
    * Click Save on the block, and then click Publish at the top right of the screen.

* **Step 3:** The Final Live Test
    * Open your Salesforce Service Console app.
    * Open the Omni-Channel widget and go Available - Voice.
    * Grab your phone and call your +1 877-424-9854 number.

`Listen to the prompt, press 1 and watch that widget ring! Let me know the exact second you see the call pop on your screen.`

## Amazon Connect Softphone sandbox

* Sample Link: https://democontactcenter00ddl00000tcuew.my.connect.aws/ccp-v2/softphone (instance/ccp-v2/softphone)
* If you can't hear audio there, the issue is with the AWS instance configuration.


