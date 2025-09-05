

**WebRTC technical**  
**implementation guide**  
 

**Table of Contents**

**[What Is WebRTC used for?	3](#what-is-webrtc-used-for?)**

[**WebRTC Tutorials & Best Practices	3**](#webrtc-tutorials-&-best-practices)

[WebRTC Credential Authentication	3](#webrtc-credential-authentication)

[Telnyx JavaScript SDK	5](#telnyx-javascript-sdk)

[Client Initialization	5](#client-initialization)

[Client Authentication	5](#client-authentication)

[Client Registration	6](#client-registration)

[Call Events	6](#call-events)

[Call States	7](#call-states)

[HTML Audio Element	7](#html-audio-element)

[Sample Vanilla JS app	8](#sample-vanilla-js-app)

[Demo App	8](#demo-app)

[Telnyx React SDK	8](#telnyx-react-sdk)

[Client Initialization	8](#client-initialization-1)

[Phone Component	8](#phone-component)

[Sample React App	9](#sample-react-app)

[Telnyx Android SDK	10](#telnyx-android-sdk)

[Client Initialization	10](#client-initialization-2)

[Push Notification	10](#push-notification)

[Sample Android App	10](#sample-android-app)

[Telnyx iOS SDK	11](#telnyx-ios-sdk)

[Client Initialization	11](#client-initialization-3)

[Setup Callkit	11](#setup-callkit)

[Setup PushKit	11](#setup-pushkit)

[Push notification	11](#push-notification-1)

[Code flow	12](#code-flow)

[Sample iOS app	12](#sample-ios-app)

[**WebRTC Use Cases	13**](#webrtc-use-cases)

[Unified Communications as a Service (UCaaS)	13](#unified-communications-as-a-service-\(ucaas\))

[Frontend Implementation	13](#frontend-implementation)

[Backend Implementation	13](#heading=h.ssop8jyn1v7f)

[Contact Center as a Service (CCaaS)	14](#contact-center-as-a-service-\(ccaas\))

[Frontend Implementation	14](#frontend-implementation-1)

[Backend Implementation	16](#backend-implementation)

[Outbound Dialer	20](#outbound-dialer)

[Frontend Implementation	20](#frontend-implementation-2)

[Backend Implementation	21](#backend-implementation-1)

[**Contact Information	26**](#contact-information)

### 

### 

### 

Welcome to the Telnyx WebRTC Implementation Guide, a comprehensive resource designed to help you leverage the power of Web Real-Time Communication (WebRTC) technologies. This guide is crafted for developers and businesses looking to integrate seamless voice, video, and data communication directly into their applications without the need for complex telecommunications infrastructure or third-party services.

## **How this guide can help you**

This guide begins with a series of tutorials and best practices that lay the groundwork for understanding and using WebRTC effectively. It covers everything from basic credential authentication to the intricacies of client registration and call handling. You'll find detailed sections on how to use the Telnyx JavaScript, React, Android, and iOS SDKs, each tailored to meet the specific needs of different development environments and platforms.

* **JavaScript and React SDKs:** These sections include step-by-step instructions on initializing clients, managing call events, and embedding audio components. They provide a solid foundation for web developers looking to integrate telecommunications features into their applications.  
* **Android and iOS SDKs:** Tailored for mobile developers, these chapters explain how to set up push notifications, integrate with native call interfaces, and handle various call states and events to ensure a seamless user experience on mobile devices.

Additionally, this guide includes several real-world use cases, such as Unified Communications as a Service (UCaaS) and Contact Center as a Service (CCaaS), demonstrating how to implement frontend and backend components for scalable communication solutions.

## **Ready to implement?**

Each section of this guide is designed to be standalone, allowing you to jump directly to the topics that are most relevant to your needs. From a simple vanilla JavaScript application to complex iOS and Android apps, you'll find clear examples and code snippets to help you build robust, effective communication solutions.

Whether you are new to WebRTC or looking to expand your existing communications infrastructure, the Telnyx WebRTC Implementation Guide is your gateway to unlocking the full potential of real-time communications in your applications. Explore detailed tutorials, insightful best practices, and practical demonstrations that will empower you to bring your communication capabilities to the next level.

# **What Is WebRTC used for?** {#what-is-webrtc-used-for?}

WebRTC, short for Web Real-Time Communications, is an open-source protocol facilitating direct, browser-to-browser connections for voice, video, and data sharing. It revolutionizes how we interact online by making real-time communication seamless and accessible directly through web browsers without additional plugins or software.

By incorporating WebRTC technology through Telnyx, organizations can significantly enhance their communication systems and customer experience. This integration supports communication across different devices via the Session Initiation Protocol (SIP), offering substantial benefits:

**Enhanced customer insights:** Utilizing WebRTC allows for embedding live conversations within web browsers, providing immediate context to interactions. This reduces the need for repetitive information exchange and streamlines customer service processes, improving the overall customer experience (CX).

**Simplicity in implementation**: WebRTC simplifies communication technology deployment. It operates natively in web browsers, thereby removing the costs associated with software installation, SaaS subscriptions, and hardware configurations. This simplicity helps businesses focus on their core operations without the hassle of complex IT setups.

**Versatile communication options:** With the support of Telnyx's telephony engine, WebRTC bridges the gap between web-based applications and global communication networks, including the Public Switched Telephone Network (PSTN). This flexibility ensures that businesses can connect with anyone, anywhere, through a variety of channels.

# **WebRTC tutorials & best practices** {#webrtc-tutorials-&-best-practices}

The Telnyx WebRTC client connects your application to the Telnyx backend, enabling you to make outgoing calls and handle incoming calls.

## **WebRTC credential authentication**  {#webrtc-credential-authentication}

Telnyx provides three distinct types of telephony credentials to authenticate webRTC calls, tailored to meet various business/use case needs.

**SIP Connection credentials** are the fundamental way to authenticate calls through Telnyx. Users can easily set up these credentials through the Telnyx portal by creating a SIP connection and customizing their username and password. This method is ideal for straightforward authentication, allowing for efficient call management and integration with various softphone clients.

**On-demand credentials** offer a dynamic approach to call authentication. Created via [Telnyx Telephony Credential RESTful API](https://developers.telnyx.com/api/telephony-credentials/create-telephony-credential), these credentials enable businesses to programmatically generate user-specific access for SIP connections. This feature is particularly beneficial for onboarding new users or customers, providing them with unique security credentials. However, it's important to note that these credentials are designed primarily for outbound calls, with inbound call functionality currently limited to direct SIP URI calling only.

**Telnyx Access Tokens (JSON Web Tokens)** provide a secure and temporary authentication method, generated through [Telnyx access token API](https://developers.telnyx.com/api/telephony-credentials/create-telephony-credential-token). These tokens, valid for 24 hours, offer a layer of security by ensuring temporary access. This is especially useful for granting temporary access to users or guests, allowing them to utilize WebRTC and VoIP services without compromising long-term security.

Each of these credential types serves different purposes, catering to various scenarios from simple call authentication to complex, programmable user access management. Whether you need persistent SIP connection credentials, flexible on-demand credentials for dynamic user management, or secure, temporary access via JWTs. 

The relationship between a SIP connections, on-demand credentials and access tokens is such that a SIP connection would typically be an overarching organization (ABC Corporation), the on-demand credential would be a specific user or agent within the organization (ABC Corporation Agent) and an access token would be the the way the agent is authenticated. 

Telnyx recommends the use of access tokens whenever possible.

![][image1]

## **Telnyx JavaScript SDK** {#telnyx-javascript-sdk}

### **Client initialization** {#client-initialization}

The Javascript SDK can be added to your application in the following ways:

* installing it using npm package: [https://www.npmjs.com/package/@telnyx/webrtc](https://www.npmjs.com/package/@telnyx/webrtc)  
* as a script in your web application using one of the external CDNs:  
  * [https://unpkg.com/@telnyx/webrtc](https://unpkg.com/@telnyx/webrtc)  
  * [https://cdn.jsdelivr.net/npm/@telnyx/webrtc](https://cdn.jsdelivr.net/npm/@telnyx/webrtc)

Depending on your preferred setup, the client can be initialized using a NodeJS backend or via CDN bundle. 

**CDN Example**

```javascript
// Include the Telnyx WEBRTC JS SDK
<script
   type="text/javascript"
   src="https://unpkg.com/@telnyx/webrtc@2.9.0/lib/bundle.js">
</script>
```

**NodeJS Example[​](https://developers.telnyx.com/docs/voice/webrtc/js-client#examples)**

```javascript
// Initialize the client
const client = new TelnyxRTC({
 // Use a JWT to authenticate (recommended)
 login_token: login_token,
 // or use your Connection credentials
   login: username,
   password: password,
});

// Attach event listeners
client
 .on('telnyx.ready', () => console.log('ready to call'))
 .on('telnyx.notification', (notification) => {
   console.log('notification:', notification)
 });
```

With client initialization you can also set custom ringtones setting the following parameters:

| VALUE | DESCRIPTION |
| :---- | :---- |
| **ringbackFile** | A URL to a wav/mp3 ringback file that will be used when you disable "Generate Ringback Tone" in your SIP Connection. |
| **ringbackFile** | A URL to a wav/mp3 ringtone file. |

### **Client authentication** {#client-authentication}

The webRTC client has two main ways of authentication. You can either use a JSON Web Token (Telnyx Access Token) or Username and Password (On-Demand Credentials). 

Authenticating with a JSON Web Token:

```javascript
const client = new TelnyxRTC({
 login_token: login_token,
});
```

Note: After pasting the above content, Kindly check and remove any new line added

Authenticating with username and password credentials (on-demand credential):

```javascript
const client = new TelnyxRTC({
 login: username,
 password: password,
});
```

### 

### **Client registration**  {#client-registration}

The .on method allows the client to attach the event handler. When the client receives the telnyx.ready event, the client is ready to place phone calls.

```javascript
const client = new TelnyxRTC(options);

client.on('telnyx.ready', (client) => {
  // Your client is ready!
}).on('telnyx.error', (error) => {
  // Got an error...
})
```

### 

### **Call events** {#call-events}

When the client is initiated and in a ready state you can observe call events using telnyx.notification 

```javascript
let activeCall; client.on('telnyx.notification', (notification) => {    if (notification.type === 'callUpdate') {      activeCall = notification.call;    }  });
```

and send commands to update your call state, for instance to answer an incoming call on the ringing event:

```javascript
 client.on('telnyx.notification', (notification) => {     const call = notification.call;     // Check the type of the notification     if (notification.type === 'callUpdate' && call.state === 'ringing') {         // Answer the call as soon as the notification is received.         call.answer();     } });
```

For a full list of the call methods please refer to this [article](https://developers.telnyx.com/docs/voice/webrtc/js-call)

### **Call states** {#call-states}

You can expect the following call states in  notification.call.state attribute

| VALUE | DESCRIPTION |
| :---- | :---- |
| **new** | New call has been created in the client. |
| **trying** | It's attempting to call someone. |
| **requesting** | The outbound call is being sent to the server. |
| **recovering** | The previous call is recovering after the page refreshes. If the user refreshes the page during a call, it will automatically join the latest call. |
| **ringing** | Someone is attempting to call you. |
| **answering** | You are attempting to answer this inbound call. |
| **early** | It receives the media before the call has been answered. |
| **active** | Call has become active. |
| **held** | Call has been held. |
| **hangup** | Call has ended. |
| **destroy** | Call has been destroyed. |
| **purge** | Call has been purged. |

### **HTML audio element** {#html-audio-element}

To hear a voice call in a browser, you need to refer to an audio element in your code

```javascript
client.remoteElement = 'remoteMedia';
```

pointing to the  corresponding HTML element

### 

```javascript
<audio id="remoteMedia" autoplay="true" />
```

### **Sample Vanilla JS app** {#sample-vanilla-js-app}

Please refer to our [sample Vanilla JavaScript application](https://github.com/team-telnyx/webrtc-examples/tree/main/js/vanilla-js-app) to check a full implementation of Telnyx Voice SDK

### **Demo app** {#demo-app}

We built a [demo app using the Voice SDK](https://webrtc.telnyx.com/) for Javascript in order to showcase the power of the SDK. Please refer to [this article](https://developers.telnyx.com/docs/voice/webrtc/quickstart) for all the instructions on how to configure your Telnyx account to handle WebRTC calls with our demo app.

## **Telnyx React SDK** {#telnyx-react-sdk}

### **Client initialization**  {#client-initialization-1}

The React SDK can be added to your application in the following way:

* installing it using npm package: 

```javascript
npm install --save @telnyx/react-client @telnyx/webrtc
```

In a TelnyxRTCProvider component you can pass credentials and options objects with custom ringtones:

```javascript
// App.jsx
import { TelnyxRTCProvider } from '@telnyx/react-client';

function App() {
  const credential = {
    login_token: 'mytoken',
  };

 const options = {
   ringtoneFile: "./ringtone.mp3",
   ringbackFile: "./ringback.mp3",
 };

  return (
    <TelnyxRTCProvider credential={credential} options={options}>
      <Phone />
    </TelnyxRTCProvider>
  );
}
```

### 

### **Phone component** {#phone-component}

In the Phone component you would subscribe to the notifications from WebRTC client, specify callbacks for Telnyx client event handlers and define an Audio element

First import React client:

```javascript
import { useNotification, Audio, useCallbacks,} from "@telnyx/react-client";
```

Define a Phone function component where you will manage event handlers using callbacks and control audio stream in \<Audio … /\> element:

```javascript
const Phone = () => {const notification = useNotification();const activeCall = notification && notification.call;useCallbacks({   onReady: (status) => {     console.log("WebRTC client ready");     console.log(status);   },   onError: (error) => {     console.log("WebRTC client error");     console.error(error);   },   onSocketError: (error) => {     console.log("WebRTC client socket error");     console.error(error);   },   onSocketClose: () => {     console.log("WebRTC client socket closed");   },   onNotification: (message) => {     console.log("WebRTC client notification:", message);     if (message.type === "callUpdate") {       const call = message.call;       console.log("Call state:", call.state);     }   }, }); return (   <div>     <Audio stream={activeCall && activeCall.remoteStream} />   </div> );};
```

### **Sample React App** {#sample-react-app}

Please refer to our [sample React application](https://github.com/team-telnyx/webrtc-examples/tree/main/react-client/react-app) to check a full implementation of Telnyx Voice SDK with a React component.

## 

## 

## **Telnyx Android SDK** {#telnyx-android-sdk}

### **Client initialization** {#client-initialization-2}

To initialize the Android client, please follow the steps below:

* Setup the [TelnyxRTC Android SDK](https://github.com/team-telnyx/telnyx-webrtc-android?lang=android) into your project. The SDK is delivered through [Jitpack](https://jitpack.io/#team-telnyx/telnyx-webrtc-android?lang=android).  
    
* Add the following permissions into your project manifest:

```java
android.permission.INTERNETandroid.permission.RECORD_AUDIOandroid.permission.MODIFY_AUDIO_SETTINGS
```


* Initialize the client:


```java
telnyxClient = TelnyxClient(context)
telnyxClient.connect()
```

* Logging into Telnyx Client with your chosen authentication method:

```java
telnyxClient.tokenLogin(tokenConfig)//ORtelnyxClient.credentialLogin(credentialConfig)
```

### **Push notification** {#push-notification}

In order to receive incoming calls while the app is running in background or closed, you will need to perform a set of configurations over your Mission Control Portal Account and your application. In [this article](https://support.telnyx.com/en/articles/8268140-android-push-notification-setup) you will find all details how to setup push notifications for Android client

### 

### **Sample Android App** {#sample-android-app}

Please refer to our [sample Android application](https://github.com/team-telnyx/telnyx-webrtc-android) to check a full implementation of Telnyx Voice SDK

## **Telnyx iOS SDK** {#telnyx-ios-sdk}

### **Client initialization** {#client-initialization-3}

To initialize the iOS client, please follow the steps below:

* Setup the [TelnyxRTC iOS SDK](https://github.com/team-telnyx/telnyx-webrtc-ios#adding-telnyx-sdk-to-your-ios-client-application?lang=ios) into your project.  
    
* Enable the following capabilities into your app:  
  * Background mode: Audio, Airplay and Picture in picture  
  * Background mode: Voice over IP  
  * Push Notifications  
      
* Import the SDK into your ViewController, create an instance of the SDK and setup the delegate:

```java
import TelnyxRTClet client = TxClient()client.delegate = self
```

### **Setup Callkit** {#setup-callkit}

Use CallKit to integrate your calling services with other call-related apps on the system. CallKit provides the calling interface, and you handle the back-end communication with your VoIP service. For incoming and outgoing calls, CallKit displays the same interfaces as the Phone app, giving your app a more native look and feel. CallKit also responds appropriately to system-level behaviors such as Do Not Disturb.

```java
var callKitProvider: CXProvider!let callKitCallController = CXCallController()
```

### **Setup PushKit** {#setup-pushkit}

If your app provides Voice-over-IP (VoIP) phone services, you may use PushKit to handle incoming calls on user devices. PushKit provides an efficient way to manage calls that doesn’t require your app to be running to receive calls. Upon receiving the notification, the device wakes up your app and gives it time to notify the user and connect to your call service.

```java
private var pushRegistry = PKPushRegistry.init(queue: DispatchQueue.main)
```

### **Push notification** {#push-notification-1}

In order to receive incoming calls while the app is running in background or closed, you will need to perform a set of configurations over your Mission Control Portal Account and your application. In [this article](https://support.telnyx.com/en/articles/8268170-how-to-setup-ios-push-notifications) you will find all details how to setup push notifications for iOS client

### **Code flow** {#code-flow}

1. Initialize push kit to get an APNS token  
2. Send the APNS token to register the device into Telnyx backend by login in through the SDK using the user's SIP credentials.  
3. When a PN is received through PushKit, two main actions must be executed: a. Warn the Telnyx SDK about the incoming push notification by calling processVoIPNotification in order to get the call connected. b. Register the incoming call into CallKit. This will trigger the Incoming call system notification to be displayed.  
4. The SDK will fire the delegate method onPushCall with the new instance of the call that can be answered or rejected.

### **Sample iOS app** {#sample-ios-app}

Please refer to our [sample iOS application](https://github.com/team-telnyx/telnyx-webrtc-ios) to check a full implementation of Telnyx Voice SDK

# **WebRTC use cases** {#webrtc-use-cases}

| USE CASE | USE CASE DESCRIPTION |
| :---- | :---- |
| **UCaaS** | Unified communication application that can encompass various channels, including WebRTC.  |
| **CCaaS** | Call center WebRTC client application for high volume inbound and outbound calling to be used by various industries such as (but not limited to) technical support, appointment scheduling, customer service, information hotline, and emergency response. |
| **Outbound Dialer** | Using a WebRTC client application to be able to place a high volume of outbound calls to the PSTN. The main purpose of this use case is for outbound call automation typically to be used by sales or marketing teams.   |

## **Unified Communications as a Service (UCaaS)** {#unified-communications-as-a-service-(ucaas)}

### **Frontend implementation** {#frontend-implementation}

In building a Unified Communications as a Service (UCaaS) solution leveraging Telnyx webRTC, it becomes crucial to enable SIP connection credentials with specific features like Park Outbound Calls and utilizing webhook events from the backend. This approach enhances the system's functionality and ensures seamless communication flows.

Enabling webhook events is essential for monitoring SIP connection events. It allows a predefined URL (webhook URL) to receive notifications about call events such as dailing, answering, bridging, hang-up, and voicemail completion. If the primary webhook URL fails to acknowledge the event, a failover URL is used, ensuring reliability in event notification.

Park Outbound Calls feature plays a pivotal role in managing call flows, especially in outbound communication scenarios. It allows calls to be "parked" \- temporarily held \- until further instructions are received via the Telnyx Voice API. This mechanism is particularly useful when a call requires additional processing or decision-making before connecting to the intended recipient, providing a customizable call handling experience.

When setting up a SIP connection for a UCaaS solution, especially one that integrates WebRTC, it's important to design a backend application capable of handling these sophisticated workflows. This application should utilize Telnyx's call control capabilities, as detailed in the Telnyx Voice API documentation. It involves issuing commands based on events received through the webhook URL, such as answering calls, playing audio, bridging calls, or transferring calls to another number.

## **Contact Center as a Service (CCaaS)** {#contact-center-as-a-service-(ccaas)}

In a typical contact center implementation, the inbound basic call flow is as follows:

1. A user calls the main phone number associated with the call center, and the call is answered with a text-to-speech greeting.  
2. The caller is presented with an IVR menu with several options to mark the call with a set of attributes (language, skills, department, etc.) on which the routing decisions will be made.  
3. The call is transferred to the queue where it is parked, waiting for an available agent.   
4. Calls can be automatically transferred to the most idle agents, or the agents can pick up the call manually (cherry-picking option).   
5. When the agent answers the call, call recording is initiated.  
6. The call is forwarded to multiple agents simultaneously, with call recording enabled.  
7. Additional call control options may be used during a call to mute a call, put a call on hold, initiate a call transcription, play announcements with text-to-speech, etc.

### **Frontend implementation** {#frontend-implementation-1}

**Authentication**

Agent desktop applications should have an authentication process implemented. We recommend to use authentication tokens generated based on the individual telephony credentials created for each call center agent. When an agent logs into an agent desktop application, the frontend app should request an authentication token from the backend app which will be used for the subsequent API request in the WebRTC client.

When a call is received to the number, you see which agents are logged in with the on demand generated credentials and your call center service would use our call control API to dial each of the generated credentials to connect the caller with one of the available agents. Once they're logged in, you'd want to make sure your WebRTC client can inform your call center backend that the agents are registered so the backend has a list of agents it can dial each time an inbound call is received to the main number.

See more details in the **User Authentication** section in the Backend application description for the Voice API methods to be used on the backend side.

**Agent Desktop Application**

Agent desktop application should support the following options:

**Agent Status Management**: The agent should be able to report his current status, such as Available or Unavailable, so the backend application can see the currently available agents and decide which agent should receive the next call. 

Here is an example softphone application (WebRTC client) with an option to choose a preferred audio device:  
![][image2]

**Call Control Toolbar**: The toolbar is a set of buttons for handling calls, with options like Pickup, Disconnect, Mute, Hold, etc.  
![][image3]

**Queue View** allows you to monitor the calls parked in the queues and pick up a call manually. You can also present additional data like a position in a queue and estimated wait time.  
![][image4]

Here are the functions which would be used to build the above options in the frontend app:

**Audio Device Settings**

Get a list of available audio devices:

```javascript
async function() { const client = new TelnyxRTC(options); let result = await client.getDevices(); console.log(result);}
```

Set active audio device:

```javascript
const constraints = await client.setAudioSettings({micId: '772e94959e12e589b1cc71133d32edf543d3315cfd1d0a4076a60601d4ff4df8',micLabel: 'Internal Microphone (Built-in)',echoCancellation: false})
```

**Call Control Toolbar**

Toggle microphone:

```javascript
await call.toggleAudioMute()console.log(call.state) // => 'muted'await call.toggleAudioMute()console.log(call.state) // => 'unmuted'
```

Toggle call hold:

```javascript
await call.toggleHold()console.log(call.state) // => 'held'await call.toggleHold()console.log(call.state) // => 'active'
```

### 

### **Backend implementation** {#backend-implementation}

**User authentication**

For each user generate on demand telephony credentials which should be stored in a DB and associated with the user login. Agent desktop application should request an authentication token to be created based on the telephony credentials.

**Generate on-demand telephony credentials**

On-Demand Credentials helps you onboard new customers or team members under your SIP connection, allowing you to separate each user with their own security credentials. This solution is perfect for users looking to integrate WebRTC into their own platforms so that your backend system can create outbound calls to each on demand generated credential.   
You can use the optional parameter expires\_at if you would like to set an expiration time for the credentials.

| const telnyx \= require('telnyx')('YOUR\_API\_KEY');const { data: telephonyCredentials } \= await telnyx.telephonyCredentials.create(	{"connection\_id":"1234567890","name":"My-new-credential", "expires\_at":EXPIRATION\_DATE}); |
| :---- |

**Create authentication token**

| const telnyx \= require('telnyx')('YOUR\_API\_KEY'); const accessToken \= await telnyx.telephonyCredentials.generateAccessTokenFromCredential('CREDENTIAL\_ID'); |
| :---- |

**Call flow**

In the backend application we can fully control the call flow from the initiation of the call up to the call disconnect event. Based on the webhook notification we can decide what kind of actions should be applied to the call.

To monitor the call and proceed with the call flow, we should monitor call event types received on the webhook url. Having an integration with the CRM application, we can retrieve caller data, for instance based on the caller number:

```javascript
app.post("/api/voice/inbound", async (req, res) => {    const { event_type } = req.body.data;    const { payload } = req.body.data;    const callData = await telnyx.calls.retrieve(payload.call_control_id);    const isAlive = callData.data.is_alive;    switch (event_type) {      case "call.initiated":        if (payload.direction === "incoming") {          userObj = await get_caller_data({ voiceNumber: payload.to });        } else userObj = await get_caller_data({ voiceNumber: payload.from });        call_initiated(req, userObj);        break;      case "call.answered":        call_answered(req, userObj);        break;      case "call.dtmf.received":        call_dtmf_received(req, userObj);        break;      case "call.bridged":        call_bridged(req, userObj);        break;      case "call.hangup":        call_hangup(req, userObj);        break;      case "call.recording.saved":        call_recording_saved(req, userObj);        break;      case "call.enqueued":        call_enqueued(req, userObj);        break;      case "call.dequeued":        call_dequeued(req, userObj);        break;      case "call.transcription":        handleTranscription(payload, userObj);        break;      default:    }    return res.status(200).send({});  });
```

For the call.initiated webhook, you should answer the call and provide an initial greeting with IVR options using the play text option:

```javascript
const call_initiated = async (req) => {  const { payload } = req.body.data;  const call = new telnyx.Call({    call_control_id: payload.call_control_id,  });  console.log(`Call initiated: ${payload.call_control_id}`);  try {    await call.answer();    console.log("Call answered:", payload.call_control_id);
    await call.speak({      payload: welcomePrompt,      voice: "male",      language: language,    });  } catch (err) {    console.log("Error answering a call:", err.message);  }};
```

Later, you can observe DTMF digits received to choose the next action in your call flow:

```javascript
const call_dtmf_received = async (req) => {  const { payload } = req.body.data;  const call = new telnyx.Call({    call_control_id: payload.call_control_id,  });  console.log("DTMF received:", payload.digit);  if (payload.digit === "1") {    console.log("Transfering call to external number:", transferNumber);    await call.transfer({      to: transferNumber,    });  } else if (payload.digit === "2") {    const queueName = "Sales";    console.log("Transfering call to a queue: " + queueName);    await call.enqueue({      queue_name: queueName,    });  }};
```

When the call is enqueued, you can play a prompt and music to a caller waiting for an available agent. At that stage, you should update your frontend interface in a queue view with information about the new incoming call. You can use the WebSocket interface to emit data to the agent desktop application.

```javascript
const call_enqueued = async (req) => {  const { payload } = req.body.data;  const call = new telnyx.Call({    call_control_id: payload.call_control_id,  });  console.log(    `Call ${payload.call_control_id} enqueued in ${payload.queue} queue`  );  try {    await call.speak({      payload: "Please wait while we connect you to an agent",      voice: "male",      language: "en-US",    });    await call.playback_start({      audio_url: `https://${process.env.API_SERVER_URL}/audio/queue_music.mp3`,    });    const emitObj = {      type: "call-enqueued",      payload: payload,    };    await Socket.io.emit(JSON.stringify(emitObj));  } catch (error) {    console.log("Error has occurred on call enqueued event:", error.message);  }};
```

Based on the other event types, additional actions may be performed according to your designed call flow. Please refer to our [Voice API documentation](https://developers.telnyx.com/api/call-control/dial-call) to check all your actions in your call scenario.

## **Outbound dialer** {#outbound-dialer}

In building an outbound dialer solution leveraging Telnyx webRTC, enabling SIP connection credentials with [Park Outbound Calls](https://support.telnyx.com/en/articles/4351104-sip-connection-settings#h_7e20c5a7f7) and utilizing webhook events from the backend becomes crucial. This feature allows you to combine the functionality of a front-end webRTC application with the backend voice application using Telnyx voice APIs. 

Enabling webhook events is essential for monitoring SIP connection events. It allows a predefined URL (webhook URL) to receive notifications about call events such as dailing, answering, bridging, hang-up, and voicemail completion. If the primary webhook URL fails to acknowledge the event, a failover URL is used, ensuring reliability in event notification.

In a typical outbound call flow, there are three main components:

* WebRTC Client  
* Backend Server Application  
* SIP Connection with Park Outbound Calls Enabled

### **Frontend implementation** {#frontend-implementation-2}

In a typical front-end webRTC application, there are many components that should be supported. 

**Agent status management**: The outbound dialer application should be able to display the agent's current status, such as, but not limited to, Available, Unavailable, Busy, and Offline. This type of management should not only act as an indicator for other agents but also limit agents' ability to transfer calls to unavailable agents. 

This status should also be correlated with the webRTC client state. This means that when an agent's status is set to available, the webRTC client should be fully registered and ready to place outbound calls. This should be handled at a global level, typically using state management frameworks such as [Global Context API](https://legacy.reactjs.org/docs/context.html) or [Redux](https://redux.js.org/). 

Here is an example softphone application (WebRTC client) with an option to change its current state:  
![][image5]

**Call Control Toolbar**: The toolbar is a set of buttons within your webRTC client dialer for handling calls, with options like Answer, Hangup, Mute/Unmute, Hold/Unhold, and selecting the caller ID. Here is an example of a dialer component: 

![][image6]

### 

Here are the functions written in JavaScript React which would be used to build the above options in the frontend app:

### **Backend Implementation** {#backend-implementation-1}

The backend implementation is a crucial component of a successful call. The following sequence diagram covers a typical outbound call flow using [Telnyx Voice API](https://developers.telnyx.com/docs/voice/programmable-voice/sending-commands). Below the sequence diagram, I describe each step.  
![][image7]

1\. **Client registers with Telnyx:** The process starts with the WebRTC client (the Front End App) connecting to Telnyx by sending a Client.connect (Register) request. This is essentially the WebRTC client registering with Telnyx to initiate communications.

```javascript
function connect() {
          client = new TelnyxWebRTC.TelnyxRTC({
          env: env,
          login: document.getElementById('username').value,
          password: document.getElementById('password').value,
          ringtoneFile: './sounds/incoming_call.mp3',
          // ringbackFile: './sounds/ringback_tone.mp3',
        });

    if (document.getElementById('audio').checked) {
client.enableMicrophone();
    } else {
client.disableMicrophone();
    }

        client.on('telnyx.ready', function () {
          btnConnect.classList.add('d-none');
          btnDisconnect.classList.remove('d-none');
          connectStatus.innerHTML = 'Connected';
          startCall.disabled = false;
        });

//Socket close, error and updating call states 
... 
```

2\. **Initiating a call:** Once the WebRTC client is connected, it requests to initiate a call by sending a Client.newCall(destinationNumber,callerNumber) method to Telnyx. The request requires the destination number and the caller number. This request is routed from the front-end webRTC client application to the back-end server application, which acts as the intermediary between the client and Telnyx for controlling call logic.

```javascript
 //Make Call 
      function makeCall() {
        const params = {
          callerName: 'Caller Name',
          callerNumber: 'Caller Number',
          destinationNumber: document.getElementById('number').value, // required!
          audio: document.getElementById('audio').checked,
            ? { aspectRatio: 16 / 9 }
            : false,
        };

        currentCall = client.newCall(params);
      }
```

3\. **Dialing PSTN (command):** The backend server then instructs Telnyx to dial the destination number in the PSTN using the \`Dial PSTN with Dial Command\`. This command triggers Telnyx to initiate an outbound call to the PSTN.

```
curl -X POST https://api.telnyx.com/v2/calls \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_API_TOKEN' \
-d '{
  "connection_id": "YOUR_CONNECTION_ID",
  "to": "+E.164 PSTNNUMBER",
  "from": "+E.164 CALLERNUMBER",
  "webhook_url": "https://yourserver.app/telnyx-webhooks"
}'
```

4\. **Call initiated (webhook):** Telnyx acknowledges the initiation of the call process by triggering a call.initiated webhook to the backend server. This webhook indicates that the call process has started but does not necessarily mean the call has been answered.

```
{
  "data": {
    "record_type": "event",
    "event_type": "call.initiated",
    "id": "uuid-of-the-event",
    "occurred_at": "2024-03-25T14:00:00Z",
    "payload": {
      "call_control_id": "call_control_id_of_the_initiated_call",
      "connection_id": "connection_id_used_in_the_call",
      "call_leg_id": "unique_id_for_call_leg",
      "custom_headers": [
        {
          "header_name": "X-Custom-Header",
          "header_value": "CustomValue"
        }
      ],
      "call_session_id": "unique_id_for_the_call_session",
      "client_state": "optional_client_defined_state",
      "from": "+12345678901",
      "to": "+10987654321",
      "direction": "outgoing",
      "state": "parked"
    }
  }
}
```

5\. **PSTN outbound call:** Telnyx makes the outbound call to the destination number in the PSTN network.

6\. **PSTN answered (webhook):** When the PSTN destination answers the call, Telnyx sends a notification back to the backend server through a call.answered webhook, indicating that the call had been successfully answered on the PSTN side.

```
{
  "data": {
    "record_type": "event",
    "event_type": "call.answered",
    "id": "uuid-of-the-event",
    "occurred_at": "2024-03-25T13:45:00Z",
    "payload": {
      "call_control_id": "call_control_id_of_the_call",
      "connection_id": "connection_id_used_in_the_call",
      "call_leg_id": "unique_id_for_call_leg",
      "call_session_id": "unique_id_for_the_call_session",
      "client_state": "optional_client_defined_state",
      "custom_headers": [
        {
          "header_name": "X-Header-Example",
          "header_value": "HeaderValue"
        }
      ],
      "from": "+12345678901",
      "to": "+10987654321",
      "state": "answered"
    }
  }
}
```

7\. **Bridging call legs (command):** After the call is answered, the next step is to bridge the call between the WebRTC client and the PSTN to enable two-way communication. The backend server sends a Bridge Call Legs: call.bridge(call\_control\_id) command to Telnyx, instructing it to connect the two call legs. 

```
curl -X POST https://api.telnyx.com/v2/calls/{call_control_id_webRTC}/actions/bridge \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_API_TOKEN' \
-d '{
  "call_control_id": "PSTN_CALL_CONTROL_ID"
}'
```

8\. **Call bridged (webhook):** Once the call legs are successfully bridged, Telnyx triggers a call.bridged webhook to the backend server, indicating that the WebRTC agent and the PSTN call are now connected, and the call is in progress.

```
{
  "data": {
  "record_type": "event",
    "event_type": "call.bridged",
    "id": "uuid-of-the-event",
    "occurred_at": "2024-03-25T12:34:56Z",
    "payload": {
      "call_control_id": "call_control_id_of_the_call",
      "connection_id": "connection_id_used_in_the_call",
      "call_leg_id": "unique_id_for_call_leg",
      "call_session_id": "unique_id_for_the_call_session",
      "client_state": "optional_client_defined_state",
      "from": "+12345678901",
      "to": "+10987654321",
      "state": "bridged"
    }
  }
}
```

9\. **Call in progress:** With the bridge established, the WebRTC agent (the user on the front-end client) and the PSTN participant can now communicate. This state continues until either party terminates the call. If the call is ended, Telnyx triggers a call.hangup webhook. An example call.hangup event is provided below.

```
{
  "data": {
    "record_type": "event",
    "event_type": "call.hangup",
    "id": "uuid-example-1234",
    "occurred_at": "2024-03-28T12:34:56Z",
    "payload": {
      "call_control_id": "call_control_id_example_5678",
      "connection_id": "connection_id_example_9012",
      "call_leg_id": "call_leg_id_example_3456",
      "call_session_id": "call_session_id_example_7890",
      "client_state": "example_state",
      "from": "+12345678901",
      "to": "+10987654321",
      "start_time": "2024-03-28T12:00:00Z",
      "state": "hangup",
      "hangup_cause": "normal_clearing",
      "hangup_source": "caller",
      "sip_hangup_cause": "16"
    }
  }
}
```

# **Contact Information** {#contact-information}

[Contact our team of experts](https://telnyx.com/contact-us) to learn more about Telnyx WebRTC.

## **Support information**

Please don't hesitate to contact our support team using the chat icon in the lower right corner of the screen when signed into the [Mission Control Portal,](http://portal.telnyx.com) calling \+1 (888) 980-9750, or emailing [support@telnyx.com](mailto:support@telnyx.com). We are here to help\!  


[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,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>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnAAAAFACAYAAAA8gUGTAAAjiUlEQVR4Xu2dCZRlVXnvqxkEsTG0YoCXgIrGmKWoD9A2EtcjmOStsNTnUuOAGmmFRggalKUgSoyA+uiE1SQiARQeDmkaem56nptuep7nuaq7eh6r5+qa9rvfrvpO77v3uafurb5V95y6v99aP/c53zlnn6FO3fOvfW5LTU1NjUFERETETBkUEBERETHdBgVERERETLdBARERERHTbVBARERE7FH79u1rfvzjH5sJEyZYZVpq/noYGRQQERERe8TBgweb6dOnJyrryLrP3/g+M/evP2L1+6lCgwIiIiJit+sHtc7U8CZKmPP7qzKDAiIiImK3Ka9G/XBWjAS4PIMCIiIiYrfpB7NidQOc32cVGhQQERERu0X5xwl+MOuKfr9VaFBARERE7Bb9INZV+/fvH/RdZQYFRERExLL7xS9+MQhiLqtWrYrqK1eutLUzZ84E26h+/77uK9cf/Pk7guWF7Ax//QoZFBARERHLrh/ANMDpdG1trZkxY4aZOXOm2bRpU+w6xQY4N7yV+t25pJCWtOy2224Lat1oUEBEREQsu34Aiwtn69ats+3BgweDdX39/lU/tJUa4G6++ea8eTe0JQW45ubmoOZ62WWX5c3369cvmj7vvPNse8EFF5gLL7zQ7qdPnz5BH45BAREREbHs+gFMFGTEbc6cOXlhbu7cuXberfn6/at+aHP90GWXBuv7FkKX+eurboBbsWKFGThwoA1jAwYMsKOLUl+/fn1eP9o+8sgjtt26dWun++kwKCAiIiKWXT+AuQHOr/vr+DXR71/1Q1upI3C+go7KJQUrN8C568nrYJ3/1Kc+lbf8mWeesS0BDhEREVOpH8AKhTN5jbp48eLEdZIC3NsuekMQ3EoJcH54cl+p+stc29razLRp06wf/OAHTWNjo1mzZo05//zzzbXXXmv2799vhgwZYtd98cUXzaBBg8ypU6eifnfu3JkX4K666qpgH45BAREREbHsPvnkk0EIKxTO6urq7DIJOP6yzgKcKK9KuxLeREFCW5yCv34xPvDAA7aVf6ThL+uiQQERERGxW/RDWFd99NFHg77LqR/cVH+9ChoUEBEREbtFP4h1Vb/fKjQoICIiInabfhgr1VtvvTXoswoNCoiIiIjdZt++fYNQVqxPP/10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>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,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60L+k6CDfq4DwU0AjQ20ILigxQmu/EtYgiBKO7p165YjuC7279+PcyhBcBNAYwMtCC5ocYJ77NgxgiBKPObOnZsnt126dLF9HefQgeAmgMYGWhBc0MIUBYDywZ+i0L9//5xt9HMdCG4CaGygBcEFLQguQPkggtu0adMwbaGf60BwE0BjAy0ILmhBcAGyAf1cB4KbABobaEFwQQuCC5AN6Oc6ENwE0NhAC4ILWhBcgGxAP9eB4CaAxgZaEFzQguACZAP6uQ4ENwE0NtCC4IIWBBcgG9DPdSC4CaCxgRYEF7QguADZgH6uA8FNAI0NtCC4oAXBBcgG9HMdCG4CaGygBcEFLQguQDagn+tAcBNAYwMtCC5oQXABsgH9XAeCmwAaG2hBcEELgguQDejnOhDcBNDYQAuCC1oQ3Evnyy+/DFNFyQcffBCmLgurV68OUyVBTT2PYod+rgPBTQCNDbQguKAFwTVm27ZtplatWlG8//770TZZL0Tnzp3DVM5xBgwYYHNjxoyx682bNzf169c3EyZMyKkn8dRTT5nBgwebBg0aRMfav3+/2bx5c7R+MebNm2fWrl1ry3fddVeUr+oehPBaHC+88IJXK58XX3wxTNn7kGP06tXroudNi2K9rpom6/1cC4KbABobaEFwQQuCWym4mzZtitabNWt2YaOHCOeRI0ei9UKCG5YLCVWPHj1M165do3UR3GuuucacPn3aricVXJ+469i+fXuU8wmvL1x3bNmyJWc9FNwuXbqYunXr5uQcx44dM4cOHQrT9tk7tm7d6m2p5Pz582b37t1Rec+ePTnbDxw4YP7999+cnCDXKvV93LkK3V+5k/V+rgXBTQCNDbQguKAFwc0XXGHo0KF26WRoypQp5uTJk+a3334zkyZNsrkkgvv7779HeUec4ApuvzjBdfLdrl0706hRoyj/5JNPml9++cVK4okTJ+wxZClI+aefforyIWHOrb/55ptR7uGHHzZnzpzJqRsKrmxzMurTsGFDK5wiuLVr17a56667ztY/deqUXdapUycqO6S8d+9e+8zbtGljRfa7774zw4YNs9s//PBD+5qsX7/ePPDAA9E+8vpIvl69ejnHktw999yTd79ZIev9XAuCmwAaG2hBcEELghsvuH369LHLOBlyuUKC62L27NlRfsaMGTa3c+fOKFdIcEWGRajjBNed251DkCkQghNcv15V5UI5t+4LruPBBx+MynGCG4efb9y4sV2K4LoR1p49e0bbr7/++qhc6LrjzuM/F5/58+dbMb/33nujXFgnK2S9n2tBcBNAYwMtCC5oQXDzBXfhwoVm2rRpthwnTq5cSHCrwt9eSHAFqXf48OE8wW3ZsqVdTp8+3SxatMhKojtmTQmuPB8RUuFigrts2bKcnMs7ZBqD4I4nyHxdx8CBA6Nyoeuu6jUJ7+Xrr7+2I8PyvBxhnayQ9X6uBcFNAI0NtCC4oAXBzRdc9zW6ECdOrlyTgvv555+bN954I09wFy9ebL9qF7GVkUnZ7o5ZU4I7ZMiQaJv7xTkhFNymTZvmPDtH3PmvpOAKTqyFsE5WyHo/14LgJoDGBloQXNCC4Ob/FQWZ0+nwxemOO+6wfwXB5aoruJLr2LGjXc6ZMyfKVyW4gtQPBdfl/fKjjz5qy6HgDh8+PLZ+iH/v/nYnuDJVQn557Nprr7VTLRyh4AqjR4+2x7jqqquiY7377rt2akKrVq3M2LFjbe5yCa68JiLVfs7HCa7MxxU5D+8xS2S9n2tBcBNAYwMtCC5oQXABsgH9XAeCmwAaG2hBcEELgguQDejnOhDcBNDYQAuCC1oQXIBsQD/XgeAmgMYGWhBc0ILgAmQD+rkOBDcBNDbQguCCFgQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKAFwQXIBvRzHQhuAmhsoAXBBS0ILkA2oJ/rQHATQGMDLQguaCkkuF999VVm/yA+QDkS18+h+iC4CaCxgRYEF7SEgjtz5szY/2oFAKUNzqEDwU0AjQ20ILigxRfcTp065cgtggtQPuAcOhDcBNDYQAuCC1qc4DZp0iRPbgmCKJ/AOXQguAmgsYEWBBe0hFMUwg9FACgPcA4dCG4CaGygBcEFLaHgOho0aIDgApQRcf0cqg+CmwAaG2hBcEFLIcEFgPKCfq4DwU0AjQ20ILigBcEFyAb0cx0IbgJobKAFwQUtCC5ANqCf60BwE0BjAy0ILmhBcAGyAf1cB4KbABobaEFwQQuCC5AN6Oc6ENwE0NhAC4ILWhBcgGxAP9eB4CaAxgZaEFzQguACZAP6uQ4ENwE0NtCC4IIWBBcgG9DPdSC4CaCxgRYEF7QguADZgH6uA8FNAI0NtCC4oAXBBcgG9HMdCG4CaGygBcEFLQguQDagn+tAcBNAYwMtCC5oybLg1qpVKy9COnToEKauOEuXLo3K7dq187YY8+qrr5r69evn5Hy++uors23btjAde6+XSngsf33v3r3m3nvvjd0WMmbMmDBlhg0bFqYS07Rp0zCVSbLazy8XCG4CaGygBcEFLVkWXEdV0lUMVCW4SUhyn2+88UaYKkh43L59+5rz58/bcqNGjXK2h3V9ENyaJev9XAuCmwAaG2hBcEELgpsrXVK+7bbbolzXrl3tcvPmzdEob8uWLaP6PXv2tLk+ffpE+4jcubrHjh2zOSmLrMUJnqv79NNP56w7MatKcKdOnRodU5YNGza0y379+tnc4sWLza5du6Jj+nWFAwcOxG7z1x944IGcdeGqq66y64MGDcrJC7t37zbvvvuuLcu2Nm3a2LI8l8GDB9tyt27d7LYGDRpE+z333HPReT777DObk2f29ddf551/0qRJebnTp09Hud9//z3Ku+cor5XUySpZ7+daENwE0NhAC4ILWhDcfME9d+5ctO4EN6wjSL3u3bvn5ePqytKNavpUNb3A7ZtEcB2u7AS30HYfGW0VTp48GY3gyjWPHDkyKr/99tvmxIkTpnfv3lEu7lguJyJ7/Phx888//5i5c+daod6/f7/55JNP7Pb169ebLVu22LL/LNz+IrgHDx605VWrVpnt27fbcuPGjfPqhve3du1aWxbBHT9+vN0/y2S9n2tBcBNAYwMtCC5oQXDzxcinKsEVUVu9enVeXpZ++NtC4vLhvpciuHXr1rXLiwnuxo0b887nC+6+fftytsvIsIyO7tixI+9YPpLzr1vmMrt6kydPzjmmzCMWRo0aFdV3df0pCiK3f/31l1mxYoVdOlxd/zrkOp0EN2nSJPYas0bW+7kWBDcBNDbQguCCFgQ3XvwcVQmujGTOmTMnLx8eo1BOCPNx56lJwfVzcSO4co/Tpk2L6ggyGvvjjz9G6+E9CCKV7du3j9aljn8/8stnIf5cWVc3TnBlRFimTTji7kXKzzzzjC3LcdesWWPuu+++aHsWyXo/14LgJoDGBloQXNCC4OaLkY8T3BYtWpiHHnrIfl0f1p83b17OL1O98MILpnXr1vbrfJkT6+rFIbIo+77++ut23urEiROt1D3yyCPRNIA4wXXHSyq43333XU5dWX7zzTd2nuzAgQMrd/5f/uOPP47K48aNM/fff79Zt25dlPv888/ttIK4e5PpG35+6NCheQIrz2n48OFWqAUZwX3rrbfss6tTp47NxQmuIPtPnz7d1nV/JeL555+3c6EnTJgQ3b/gzivH9KefZI2s93MtCG4CaGygBcEFLQhucuKETiiUBygG6Oc6ENwE0NhAC4ILWhDc6iEjpYKMNvoie/jwYbuUX2KS0UeAYoV+rgPBTQCNDbQguKAFwa0+P/zwQ86fnxLkF83ka/+4OaUAxQT9XAeCmwAaG2hBcEELgguQDejnOhDcBNDYQAuCC1oQXIBsQD/XgeAmgMYGWhBc0ILgAmQD+rkOBDcBNDbQguCCFgQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKAFwQUoH+RfL8tf9oiDfq4DwU0AjQ20ILigBcEFKB8WLFhg/06zRPin6+jnOhDcBNDYQAuCC1oQXIDywRdcF0eOHLHb6Oc6ENwE0NhAC4ILWpzghh+KBEGUT9xwww04hxIENwE0NtCC4IIWRnAByodwBLddu3bRNvq5DgQ3ATQ20ILgghYEF6B8cII7YMCAcBP9XAmCmwAaG2hBcEELggtQPqxevTpMRdDPdSC4CaCxgRYEF7QguADZgH6uA8FNAI0NtCC4oAXBBcgG9HMdCG4CaGygBcEFLQguQDagn+tAcBNAYwMtCC5oQXABsgH9XAeCmwAaG2hBcEELgguQDejnOhDcBNDYQAuCC1oQXIBsQD/XgeAmgMYGWhBc0ILgAmQD+rkOBDcBNDbQguCCFgQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKAFwQXIBvRzHQhuAmhsxY/8X2+JlStX5uS3bt1qHnzwQfPrr7/m1HPx448/mu3bt5vly5fn7Cfb4li6dKl56KGHzI4dO8JNVTJx4qs1Lrjff/+9OXjwYJg2586dM3PmzDHjx483+/fvDzdH1KtXzy7l/6ND8YHgAmQD+rkOBDcBNLbiR6Ts/Pnz5sSJE7Ysy3Xr1pkBAwbY7UeOHLHLsxWWICF1ZCny99577+VJXbjucgcOHLDlF154wfTr1y+okcvixYujclqC+9NPP9nrPnOm8twTJ07M2e6D4BY3CC5ANqCf60BwE0BjK358KTt+/LiZMmWKmTx5sjl16pRX6wJ+fRFckdF58+bFbi+UC9dDevToEZWd4C5ZssSrUYmMOp88eTJMF0RGnX1E1NevX29++OGHPMGt6hpFiEXwHQhucYPgAmQD+rkOBDcBNLbix5eyjRs3WpEUuS0ka6Hghrlwv2+//TZPHuvXr2+X48aNy8m/9NJLdtm1a9coJ4Jbt25dW+7QoUMk3u48ItgdO3bMybnyzJkzo7KMILsRaEGu3Z1fcuE1hvfhkGkbQt++faMcglvcILgA2YB+rgPBTQCNrfgRKXNRp06dvG1OLv2cwwmuTHGIk0xh6tSpdmTYp1u3bnZZXcH1pyi449900015uaoE18+HuTfffLPaguuQkd9Dhw7ZMoJb3CC4ANmAfq4DwU0Aja34uZiUyS+GOZET4gRXaNKkiV2Gx5NfVnv88cdzcq6OL7giydUVXKnr7xsnrUkEd9GiRdUW3BYtWtglgls6ILgA2YB+rgPBTQCNrfiJk7J9+/ZF5YYNG3pbCguuINvijuekVBCRdMf87LPPol8oGzJkSCS411xzTeWOplJwe/So/KW0L7/80qxevdqW/fPUrl07L3cxwb3qqqvM6dOno1wouL1797ajzz5//PGHvWZBrhHBLQ0QXIBsQD/XgeAmgMZW/MRJmYxOOlnduXNnzraqBFf+QkLc8QSZPyvbXnnllZx869atbV7mxzrBFSR3zz33WMH99tvTdv3ee++NtoucSq5NmzZRzs2xbd++vXn55ZerFFyhadOmdv3w4cN5git88cUX0XOYMWOGzbl9BAS3NEBwAbIB/VwHgpsAGhto4R89gBYEFyAb0M91ILgJoLGBFgQXtCC4ANmAfq4DwU0AjQ20ILigBcEFyAb0cx0IbgJobKAFwQUtCC5ANqCf60BwE0BjAy0ILmhBcAGyAf1cB4KbABobaEFwQQuCC5AN6Oc6ENwE0NhAC4ILWhBcgGxAP9eB4Cagqsbm/sg+QFUguKAFwQXIBvRzHQhuAuIam/xRfffH8wEuBoILWhBcgGxAP9eB4CbAb2z79++PxFbi//7v/7yaAPEguKAFwQXIBvRzHQhuAqSxPfroozli6wtu27ZtCaLKaNmyrWnePD9PENWNTp0688EHkAHo5zoQ3AS4xnb//ffHCi7AxWAEF7QwgguQDejnOhDcBISN7dChQwguJALBBS0ILkA2oJ/rQHATUKixbd68mV8yg2qB4IIWBBcgG9DPdSC4CaCxgRYEF7QguADZgH6uA8FNAI0NtCC4oAXBBcgG9HMdCG4CaGygBcEFLQguQDagn+tAcBNAYwMtCC5oQXABsgH9XAeCmwAaG2hBcEELgguQDejnOhDcBNDYQAuCC1oQXIBsQD/XgeAmgMYGWhBc0ILgAmQD+rkOBDcBNDbQguCCFgQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKAFwQXIBvRzHQhuAmhsoCVtwe3Xr1+YghIDwQXIBvRzHQhuAmhspU+tWrXMiBEjTIcOHUzdunVtbuzYsaZXr15mwoQJpnbt2ub77783Q4YMMe3atbP1pTxu3DgzefJku+7z+uuv56w7wnqOtAW30HVB6YDgAmQD+rkOBDcBNLbSxxc8Vy4kfSK1/jYR3EWLFplvv/02ysUJbtu2bc2BAwfMzp07w03mmWfeyRHckydPmjlz5ng1qmbr1q1m06ZNYdrMmDEjKk+fPt3bUsnnn39ul4XuFUoHBBcgG9DPdSC4CaCxlT5xgjt69OjYr+7jBFfwc3GC67bLaLCfGzVqlB3BddunTp1q9u3bZ8vLly838+bNi6S4fv36ZsuWLdG+Qr169czx48fNqVOnbNltGzBggC0LPXr0sEs3On348GEzcOBAW65Tpw6CWwYguADZgH6uA8FNAI2t9BHBc7F58+acbSKkMl3BUUhwBZniIISCK/L5/PPP23KcTIvg3nffa7aejMZK/vz581G9a6+91pw5c8b88ccfpmXLljb3yCOPmN27d9u669evt+GO55+jWbNm0fZZs2bl1HOE61B6ILgA2YB+rgPBTQCNrfS5mOD526sS3KZNm9plKLgNGjQwH374oQ2ZKjB//nybjxNcR9++fU3v3r2jeq1bt47K77zzjhXgbdu2xV67n2vSpIm3pZJwn3AdSg8EFyAb0M91ILgJoLGVPnGC58tmdQVXkG2h4IbHd+txgivTB8J6Isiu/O6770ZTEQQZYXajvefOnbNL/3xnK8znpptuitaFBQsWmK+++sqWu3Tpknd9UHoguADZgH6uA8FNAI2t9IkTPMm5mDt3bpS/mODKnNZQcK+//vqcddl/1apVsYL72GOPRef94IMP7Pa33nrLNGrUyJZlvq1/fpFb/1qF8H5k7q6/XXDrS5YsyasPpQeCC5AN6Oc6ENwE0NhAS9p/JgxKHwQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKAFwQXIBvRzHQhuAmhsoAXBBS0ILkA2oJ/rQHATQGMDLQguaEFwAbIB/VwHgpsAGhtoQXBBC4ILkA3o5zoQ3ATQ2EALggtaEFyAbEA/14HgJoDGBloQXNCC4AJkA/q5DgQ3ATQ20ILgQnUJ/2GHA8EFyAb0cx0IbgJobKAFwYXq4v/XOokzZyrbDYILkA3o5zoQ3ARIYws/dAiCIK5knDp1lg8+gAxAP9eB4CaAxgZaGMGF6hKKrcSMGTMYwQXICPRzHQhuAmhsoAXBheoSyu2JEydsHsEFyAb0cx0IbgJobKAFwYXq4sQ2BMEFyAb0cx0IbgJobKAFwYXqcvTo0TBlQXABsgH9XAeCmwAaG2hBcEELgguQDejnOhDcBNDYQAuCC1oQXIBsQD/XgeAmgMYGWhBc0ILgAmQD+rkOBDcBNDbQguCCFgQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKAFwQXIBvRzHQhuAmhsoAXBBS0ILkA2oJ/rQHATQGMDLQguaEFwAbIB/VwHgpsAGhtoQXBBC4ILkA3o5zoQ3ATQ2EALggtaEFyAbEA/14HgJoDGBloQXNCSNcGtVatWXoTE5dLAXUexXE91qV+/fphKhNzvhg0bwrT6OQwbNixMZYos9fOaAMFNAI0NtCC4oCVrgusYMWKEOX/+fJguKrIsuBs3bgzT6ueA4Gavn19OENwE0NhAC4ILWhBcY/78809z5syZWKF0o7zr1q0zy5cvt7lGjRpF+X79+kV1a9eubXN169a165s3bzbnzp2zuVCm3f7uXHXq1MlZd3X8pY+//8qVK6OcO44shaNHj0b1xo8fH3t8v/zJJ5/EXoe7N7cu0b1795w6Eg0aNMgTXLffoUOHovL+/fvN6tWro+0SY8aMidZ3794dex0uWrVqlZd39yzUq1cvyrvXzRdc/7hZIYv9/HKC4CaAxgZaEFzQguBWCm7Pnj2jbU5+GjduHOXuu+8+K0oirKHYCTNmzDD//vuvLT/++ONWmEVwhw4dGtV1tG7dOkxFyPGfffZZW3bHrkrGVq1aFVuvYcOGdiky7jNnzhy7lHvfunWrFWBh7NixdhkKZZjr1KlTVHbPx39OQiHBlaUIsOCur9D5rrvuuth8mPPvb8WKFWb9+vVmx44d5qWXXoryrq4T3KqeZzmTxX5+OUFwE0BjAy0ILmhBcCsFV6TIESdUJ0+etIJ77Ngxs2TJkijfvHlzuxTJa9q0aRQyOimCu23btqiuI06wJNe+fXvTrVs3M27cuCjnL30k17FjRyuccfXatm0blUWo/W0y+tmnTx9blrwIuUNGav37cHUcUq5quxAKrvvhQUZYFy9ebMv+NccdT0bMHXH3F5cTbrzxRjNlypScnKsjgiv399RTT+VszwpZ7OeXEwQ3ATQ20ILgghYEt7DgutFG4bPPPrOCe7bigd1zzz1R3tW9//77zcGDB6O8UEhww1FVwY30ytf4FxNcmZ/622+/2fKHH34YW88XXIdfL67s1/Hxc27k1Uek0ScUXOHbb7+NpFWevZvGUeh8t9xyS866vyyUkxHpZcuW2V9Q+/LLL6O8q+NGcJs0aRJtyxJZ7OeXEwQ3ATQ20ILgghYEt7DguvKoUaPMq6++Gs3lFKG7++677VSFli1b5tQdPHhwzhzcOMEVXF0nh7L+yCOP2FwhwR0yZIi58847o5yI9qeffppXT3CCK0Iq1yrrIpmu3gsvvGDLMh3C309Gc+X6Bw4caLp27RrV95H14cOHR3k3z3jkyJH2fuIEN3ymJ06csGUZGZd1EVr/PqZNmxadQ36oiDuGX77rrrvycvLatGnTxowePdrmmIObvX5+OUFwE0BjAy0ILmjJquAmRWR106ZNYdr+MhNAKUA/14HgJoDGBloQXNCC4BbGzbt1I5QON8Iq82yzOBIIpQn9XAeCmwAaG2hBcEELgguQDejnOhDcBNDYQAuCC1oQXIBsQD/XgeAmgMYGWhBc0ILgAmQD+rkOBDcBNDbQguCCFgQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKAFwQXIBvRzHQhuAmhsoAXBBS0ILkD5sGDBgugfeoTQz3UguAmgsYEWBBe0ILgA5YMIrvxtZomZM2fmbKOf60BwE0BjAy0ILmhBcAHKB19wXbz//vt2G/1cB4KbABobaEFwQYsT3Lp16xIEUeJRp06dPMGVmD59Os6hBMFNAI0NtCC4oIURXIDyIRzB/fDDD6Nt9HMdCG4CaGygBcEFLQguQPngBPe///1vuIl+rgTBTQCNDbQguKAFwQUoH06cOBGmIujnOhDcBNDYQAuCC1oQXIBsQD/XgeAmgMYGWhBc0ILgAmQD+rkOBDcBNDbQklXB3b7xZYIo2jhy4LewyQKkDs6hA8FNAI0NtGRVcA/tnGLMsQ8IoigDwYViBOfQgeAmgMYGWhBcgii+QHChGME5dCC4CaCxgRYElyCKLxBcKEZwDh0IbgJobKAFwSWI4gsEF4oRnEMHgpsAGhtoQXAJovgCwYViBOfQgeAmgMYGWhBcgii+QHChGME5dCC4CaCxgRYElyCKLxBcKEZwDh0IbgJobKAFwY2P5s0a2Xhu4i1521zUrl07LyfR4+q2ebnqhpyzVcsmZuxDN+TkmzZtaBo1qm/+2fyGeWfKfdH1uXD7hsf7dcmzOet9r+2YV+dyx4hbeuXl9m172yz7IfdaXJz5d7a56caro/XwPnr2aJe3j8Tm1a+abRv+m5d3z2T0vQPycuEzk+jQvrlp2LCeeW/66LxjuX3DXE0HggvFCM6hA8FNAI0NtCC48dGkSYOoXKtWrbztVYVGcK/p3SEqu/P659+8+rWofNvw3jn7Sr0GDerl5H5e/HTOereurXPWazKaVUi5K1cluBL+Pcqz37/9bVv+ePZDFa/VtLz6EoUE1z9W+Nr17tm+YN0t6/+Td6xfKp5fv+su7w8F4TXFBYILxQjOoQPBTQCNDbQguPERJ7gdr2phdv81JVY8pSwx95NHI8Fd9v0zUT6u7vzPH88778UE1484we3SuZU5++/sKFcdwV04d0LeNQ7o19muX3fNVXnSXLdunZxzhuVbh/UyM966N+eYlYJ74XmE1+Bypw7OMit/et5c1aGFXa9fv25UR4RZ6vXoXvl8RXA3rJqcd8xCZQlfcO+/p7/Zs6XqdiD7y/OcPePC6O64R26MznnHyGuifJPGDWyuc6eWdn3pd5PMsb0zc65v3MMX9g3P5QeCC8UIzqEDwU0AjQ20ILjxIQIiUxBkefrQezYngvvma3fl1PGXEit/fj4S3DjRkmOEOT/iBPfInnds+Z2p9+XUjRPc8LjVEVxX/9yR903/vp1sWaZDyPL80ffzrvObLx43J/a/a8vTK0TWSWKvnpVTCURw/eNKiOAOHtQtWh96U4+cY17fv7NdNmtWOeob3kvt2rXMpt8n2/LNg7vbpQjuxPE3R8e45eaeOfs4yfbP4wtuuC0u3DSUuNfSL//+8wtm+8Y3bPnWW3pZKRbBHXFL5Wv07+4Z5sVnRuTtXygQXChGcA4dCG4CaGygBcGNDzeC+8evL0VC4supRChhLpzgtmhxYe6mX3fSE0NtyLxPfz+33cWhndOj/PF9lSOBLzxza5QrJLitWjaORnEvJrgnD7xrpdpdkxxjU4U4fvvF+Lzj+jF8aE/z19rXrAC3bNHY/hAw//PH7LZCguuPWPe/rlKkXciUhEXznoj2cSO3cc/trtuuNWt/ezkawXXH8Ou68M8hkURwd2x6w6xf8UpOXXkdxj54YX60ew1lHq+7vodGDzTrV75iBffo3plR3Xvu7Fut80oguFCM4Bw6ENwE0NhAC4IbH4WmKPh1fKHy805w27VrdtG6YfgjuHHh719IcP3yxQRXRoeffHxITm5dhdT9sviZvGP5IbnG/xvllbIbgZUoJLj+HNxQcCXaVzyvOnUqR0w3VoirjBJPf+uevGO5qEpwZbnq5xfMVx8/mrNPzhSFUf3Nzj/fzDuuf7w/lr1oQ56HxNGK5/XMU8OiOm6kW34JMNxfBPf4/0a6JRBcKHVwDh0IbgJobKAFwY2PJIIrI5gu9+hDN1Y5ReGp8TebWdPuzzmOH3GC68+pra7gyjlk/WKCG+536J/KX+hyX83v/vvCnONwH5eXebp+nUsVXKk//4sLo7yNG194Ddq0bmpHSf36IrhupHfW9PvNR7MejI7jH9Pfp6pfMgvDn2vs1407vohvy5YX2oEEggvlBs6hA8FNAI0NtCC48eG+bp7+5r1R7vWX78ir48qPPnSDefiBQbbsz9OVeaHffX3hq3eJRfOfMIOu72r/QkB43qn/HZWXm/PeQ2bwDd3y/mTZh+8+kLPuX487VviXAd6YfGd0b379O2+7xtx1+7XRukj1DQO7WnGLEzIR5y3rKo8tdf1jvf/OmKh84//m3cpX9Vu9v3gw/c3KkVk/wusP12XKhhzPjaDu2zbVLmW6xLtvX/ihwd9PzunEV2LKf+7OOabEw2MGmSE3Xm2F1OVkZPjAjsq/5BB33PtG9TPPPnVLNIotIc9Kru/p/9X7u+L5uPnbEp/Mftguzx2ZHT2XQoHgQjGCc+hAcBNAYwMtCO6ViThJLIWI+yUz4kLU1LNBcKEYwTl0ILgJoLGBFgS35kJ+2UsESMKfZlAK4a5bYu/WypFSojLcX9eQcL+EdrkDwYViBOfQgeAmgMYGWhBcgii+QHChGME5dCC4CaCxgRYElyCKLxBcKEZwDh0IbgJobKAFwSWI4gsEF4oRnEMHgpsAGhtoQXAJovgCwYViBOfQgeAmgMYGWhBcgii+QHChGME5dCC4CaCxgRYElyCKLxBcKEZwDh0IbgJobKAFwSWI4gsEF4oRnEMHgpsAGhtoyargbt/4MkEUbSC4UIzgHDoQ3ATQ2EBLVgUXLh9nz/JeBJAF6Oc6ENwE0NhAC4ILWhBcgGxAP9eB4CaAxgZaEFzQguACZAP6uQ4ENwE0NtCC4IIWBBcgG9DPdSC4CaCxgRYEF7QguADZgH6uA8FNAI0NtCC4oAXBBcgG9HMdCG4CaGygBcEFLQguQDagn+tAcBNAYwMtCC5oQXABsgH9XAeCmwAaG2hBcEELgguQDejnOhDcBNDYQAuCC1oQXIBsQD/XgeAmgMYGWhBc0ILgAmQD+rkOBDcBNDbQguCCFgQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKCllAV3/fr1YcrSqFGjMJWYn3/+2WzdujVMRyxdutTUq1fPlmvVqhVsLQ7cdf3777/miy++iN12KWj2rS7uHMOGDQu2pEOhew6fq+PBBx8MU6lTqv28WEBwE0BjAy0ILmgpVsEVeTx8+LCZPn16Qbn4888/w5RFI7iHDh2Kzrd9+3azd+/eoEYlFxPcbt26hakrTjEJbteuXcNUldS04Ca9h0L158+fH6YsTnAL7ZcGxdjPSwkENwE0NtCC4IKWYhZch5OEadOmmVmzZplbbrnF9O/f3wwaNCiqs3LlStOwYUNz7ty5HMGV8pgxY8x1110X5QSp+9RTT+XkhEJCcuutt9p9jh49atcvRXB79+5tGjdunJN7/fXXo+udOHGiXc6YMcOe64knnrDr4T4O2a9Nmzb2ngUp+/d+McGVHyDkPLt27YryHTp0MN988409zo4dO+xzFeQcUldGtv37bdq0qWndurVZvnx5lBPkmuV+Hf4+mzZtssd6+OGH7bocU9b9Uc/qCO7ChQvtfi+//LJdP3PmTPR6Ox577DG7lLw71o8//miP37x5c7veokUL89dff9ljCV9++aUt//PPP5UHMfGvseCL++TJk6NjuHsZOXJktD1tirGflxIIbgJobKAFwQUtxSq4derUMc8++6y5+eabzfPPP29zb7zxhs07+vTpY5dnK26ibdu2tizS4yTPlxJXXrFiRVTevHmzlRmfQiLjcNuTCq6Iz/nz523Z1Zelkzy5z3Hjxtnyk08+aZeO4cOH56wLced0+McXCgnu7t27bblJkyY5+ePHj9vytm3bInF1x5Jn7coNGjSo3Mnb7pdFip0AOuGTEXH5AcXHCfqIESPM6dOnbdkdo5Dgrlu3zrz66qs5OXcf+/fvN126dLHlBx54IDrGc889F91beL3u24AlS5aYjz76yJbletwxCz3vVq1a2aVMl3E/oNxwww3R/cr9TJ06NaqfJsXYz0sJBDcBNDbQguCClmIV3LgRXBFcXzSc4P7nP/8xBw4ciPJVCa4cV8ouZPTOp5DIiEyJXLvtSQXXP6er7+8nkucEV/KhvIXMmzcvTJl777039viFBNfx22+/md9//z0v7wvunXfeGeXD4wsi6I64e507d65d9urVK6rnEFmVkWCpu2fPHptz+xUSXP/cgkipyLfDbRfBdcicahmp9beHZb/dCXH36uMEt3379jl5fzQ67p7ToBj7eSmB4CaAxgZaEFzQUgqC676iLyS47777bs7X7FUJbv369c3s2bOjfEicyEguHH29FMEN8XO+4AqnTp2K3ccxZ86cnPW4e3XLiwnut99+a7Zs2ZKX9wVXpmg4wuMLQ4YMicpXXXVVVHbI1BKhb9++OXkZRZfzCzJ14FIFV6ZVyJQKh9ueVHClffjE3auPE9zwnn3BDe85LYqxn5cSCG4CaGygBcEFLcUsuDIit3HjxkguCgmuyKfL33HHHTmCK+Io4bbLV8b+MTZs2BCVBREl99W7nP/YsWO2vszv9KXzYoLbuXNnK91OvGW+sMwhFn755Re7FHF3UytkHqsT3FCm447vcvJLcf66fFUe7ucLrr9NpoD4ubAcN0VBRnpduUePHlZQ/e2ufOLECVt299yzZ0+7lNfCjZrLc5D5uPKLhG6/6gquzIXu3r27LS9YsMAu3T4yh9ndW1LBldfZze1u1qyZufHGG/Pq+DjBPXnyZDTnWOZCO8GVe5RfViwGirGflxIIbgJobKAFwQUtxSq4l4KITYj7LfdQUESKZD5uIT744AOzZs2aaP3TTz+N5opeKiKuM2fODNPmww8/tNvcL0SJhH388cfRdhnZjEP2c3NKBSeKVbF48eKcdSeg1UFGykNk5Hfnzp12vqqP/ODgT6MIn//bb78dlWX/P/74w9tafcLrr2p0PiQcBfd55513wlS1kNfEJ7zvNCmXfp4WCG4CaGygBcEFLeUkuFVRTKLhkNFCh/wincxFLSXi5rwWQu7N/6sESZHj+5EWSa/jpptuClOpkYV+XpMguAmgsYEWBBe0lLPgPv3003a6gZsGUGzIaKrM1ZVfXhs/fny4ueiR6Qvyp7ZkqsXBgwfDzVBklGs/v1IguAmgsYEWBBe0lLPgAsAF6Oc6ENwE0NhAC4ILWhBcgGxAP9eB4CaAxgZaEFzQguACZAP6uQ4ENwE0NtCC4IIWBBcgG9DPdSC4CaCxgRYEF7QguADZgH6uA8FNAI0NtCC4oKUqwZV/EAAA5UGhfg7VA8FNAI0NtCC4oCVOcOXvs1b373wCQGkQ9nNIBoKbABobaEFwQYsvuPLvT5P+IXsAKA1wDh0IbgJobKAFwQUtTnBDsSUIorwC59CB4CaAxgZaEFzQ4o/gvvXWW3kfigBQHuAcOhDcBNDYQAuCC1ri5uBOmjTJ/N///R+CC1BGhP0ckoHgJoDGBloQXNASJ7gO/ooCQPlQqJ9D9UBwE0BjAy0ILmipSnABoHygn+tAcBNAYwMtCC5oQXABsgH9XAeCmwAaG2hBcEELgguQDejnOhDcBNDYQAuCC1oQXIBsQD/XgeAmgMYGWhBc0ILgAmQD+rkOBDcBNDbQguCCFgQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKAFwQXIBvRzHQhuAmhsoAXBBS0ILkA2oJ/rQHATQGMDLQguaEFwAbIB/VwHgpsAGhtoQXBBC4JbGjRq1Mgud+/ebVasWJGzbe3atWbLli05uerijnupaPd3xB3n0KFD5vvvvw/TiYg7blahn+tAcBNAYwMtCC5oybrgPvPMMzZq1apll9OnT8/ZfvDgQbNv376cXBrI9Qm7du0yy5cvz9n2xx9/mL/++isnF3L06FGzffv2MB0d91IJ93/11VetmAqnT5/O2R7W9YnbJs/+u+++C9OJiDtuVslyP78cILgJoLGBFgQXtGRdcB2+CG3cuNHK1WuvvWZOnjxpTpw4YfPnzp0zEydONGfOnDHr16+P6u/cudOKnbBnz54oP2XKFLNu3bpo/e+//7ay/MYbb0Q5x6+//mreeuutaF1GaeX8josJrlzDtGnT7LU7NmzYYI4fP25eeukle81yL47nnnvOSq9/3/v37zcvvPCCLW/bti3Kz5gxw6xZsyZaF15++WVz4MCBWIG87rrr7HLw4MHmvvvui/J+XXkG/rXKtk2bNtlzOeQ1WLRokfnoo4/M0qVLo7zw9ddfmy+//DInJ9f8/PPP5+T8c/qvWRahn+tAcBNAYwMtCC5oQXArCUcaJerXr28lTATS5Z966qlou19fxKpt27bm2WeftbkmTZqYRx991NStW9eOZApyPKnbuHHjaF9B9q1du7bp3LlzlOvRo4d54oknTJ06dez6xQT37rvvNq+88kredUm0bNnSTm1wgic5ObZ/H6tWrbJlkeGGDRuaYcOG2XyDBg3MmDFj7PU50ZdrGj16tF3653O4nCzlekW+BXkWgjyHJ598MmdfOVb37t1Nhw4dTP/+/W1OBPfBBx+MRtiPHDli8wMGDLD31K5dO9OvXz+bO3XqlK0THteV5dmK5GcZ+rkOBDcBNDbQguCCFgS3kjgpEnzBjRuNvP7666Pc5s2bI8Ft3bp1lPeFL45CeSHct5Dgitw66tWrZ5f+cX3BFfl2+McXSRRkZNcX3LBu3P4+4TWLvIqszp0716537do1qht3ra4s+4wdOzbKd+nSJWe7X/ZzH3/8cXQvkheZX7lyZbQ9q9DPdSC4CaCxgRYEF7QguJXESZPgBFe+3v/ss8/y6jRv3jzKCU5wZSRywoQJUQhxMiiE+fbt25ubbrrJTm8IBa6Q4MrX+45wH8EJroxijhs3LsrH1RWc4IqAhvfRs2fPqF64n+BGVT/99FO7lDp33XVXtP1iz0bKe/fuzZuD26lTJ7v0f3Es7vplxHj27NlRvmnTpjnTM7IK/VwHgpsAGhtoQXBBC4JbSShYDn8Et0+fPlHe1ZGpATI3V/jhhx8iwY0Tv7icEObjrsUtCwlu3759o3UngP5x/BFcmSLg8I9/+PBhW5Z5wk5ww2sTZLqCI267zEOWqQKO3r1759Tz93fE3XMhwY2r6x9TplQ4wueXZejnOhDcBNDYQAuCC1oQ3EripEnwBVfmiMo2mf8Z1peYN29eJLjyy1EuP3LkyKheHDLi6OoKQ4YMsWU3Z1dwS19wXU6uT/L+Mfztgi+4N9xwg90mUw1cHZknLJIo6zIP1wmufLXvjtuxY0ebk7nFsi5zagvdU5j31+UXxNwx3bOREWuXc7+YV0hw5Zf1XF35E2kOl3NzeF3OEY62Zw36uQ4ENwE0NtCC4IIWBPfSCAVOECGbM2dOmC45RHbll+mgvKCf60BwE0BjAy0ILmhBcKuPfPUvX3/LyOWOHTuivHwF/9BDD8VKb6kg0y+uvvpq8/DDD5f0fUBh6Oc6ENwE0NhAC4ILWhBcgGxAP9eB4CaAxgZaEFzQguACZAP6uQ4ENwE0NtCC4IIWBBcgG9DPdSC4CaCxgRYEF7QguADZgH6uA8FNAI0NtCC4oAXBBcgG9HMdCG4CaGygBcEFLQguQDagn+tAcBNAYwMtCC5oQXAByocFCxbYP/N2/vz5cBP9XAmCmwAaG2hBcEELggtQPjjBlfD/JbNAP9eB4CaAxgZaEFzQ4gR3/vz5BEGUeDz//POR4LqQf0wi4Bw6ENwE0NhAC4ILWpzgLl++nCCIEo8333wTwa0hENwE0NhAC4ILWpiiAFA++FMU6tSpkzMXl36uA8FNAI0NtCC4oAXBBSgfRHDr1asXpi30cx0IbgJobKAFwQUtCC5ANqCf60BwE0BjAy0ILmhBcAGyAf1cR+YE9/iRTZccP/24Pi9HEEli3R8bzLKfaEfEpcfRf3kvIogshKafnzi2NdSfzJE5wd2+8WVjjn1AEARBEARRlrF7y8xQfzIHgksQBEEQBFFGgeAiuARBEARBEGUVCC6CSxAEQRAEUVaB4CK4BEEQBEEQZRUILoJLEARBEARRVoHgIrgEQRAEQRBlFQgugksQZRlH97yTl8tanP13tjlz+L28fLnGwR3T8nJJ4sT+d825I+/n5ZPGrr/esks5XriNIIgrEwgugksQRR933HZNVG7Xtpn5/psno/VatWrl1Zd47aXb83ISrVs1sftINGnSIDpGGJK/b1S/vFwYhfLFEDv/fNOsX/lKTs6/n1tu7mFzpw7OysmfP/p+3vOQ+HHhxLz7vfmm7nnn1cSbr92Vc84P330gr45EeB0SI27plZdLEl9+/Kg5+E/VkuxfW7jNryPLuZ+Mi91W1b5xdSXq1Kmdt50giMKB4CK4BFH04QuBlOvXr2vLImI3DuqWV1+iKsF15aE3VQqef2xX3r/9bXN9/855+4fx38l3mnvv6peXv9To3KllXu5So5DgunLdunWi3D+b38zbP6wvgvv0k8PM32tfj3I1IbgNG9aL1qsrgxI1LbjVvZaqBFdi0IAuebm48M+3d+tUc/cd1+XVIQgiPhBcBJcgij78D/rbhveO1p+fNDzK165d2yz4any0TQS3VYXMfvHR2JzRL19whw/tWfA8Tv6qim5dW+ft16VTK3PTjVeb6yskxo0Qu+PN++yxqO4H74wxTZs2NHfedq0ZdH0X06ljS3P60HumXkU9ufbvvp6Qc67mzRuZZT88E+0vUw8eeWBQhRC3Mi89NyLKnzwwy/4AMHvGaDOgX+cqBdeJZKuWjQvKWyi4YS5OcMNrlfh1yTOmZ492Fe8//zX3j+pnRlS8jrfd2sc8+fiQnH0LCe5dt19r+l7X0dxzV9+c/JrlL9nX+Y2KHzT6Xtsx2q9xo/pm9D39zdVd2+RcR4MG9WybcLlDO6fbujOm3GtuH3GNFVx5huHzkNdGvj3wcxLyg8ETFfcg0bhx/Zxru5jg9qu4Xqk7570H887nH8eFa6/T3rzH3pf8oPHfV+4w3bq0NhPG3WT7gKsr5VnT7jcd2jc3H8ysHAVv07qpPeaYewdEx18494noPFJ/8A3dzLQ3RplXnh9pc02bNDTzv3gs+qGSIEolEFwElyCKPkbdWTlytWLpc1Y0Zk0bbedKug9mf6T1uYm32KVIoi93vSrkSpb+FIXR9/bPOY8vFKFcxIWrM9AbkYs7hgiUyw28vrKuCG5cXV/u4mLMfZVyIoLrj/a6/f1jTn5hZKzgXtvnqjyp3bN1ql0fdH3XvPqu7AT32N6ZFTLYx5bjBNeFvBYyD1jK/jOIu28X4RSFJx6rFGAR3N1/T8nbz9+/S+dWdrl59aux52jgSZoIYrj/0CE9Co7grvrlBfN+xWsW5v0Ir6k6guty33/zVN68cfdatWld2WZdvl69Cz98+fnuV7cx549+YHr3ah/lVi97MRJcv+6y75+xr6OU5dsK+eFr7IM3mDW/vpRzDf4PDQRRSoHgIrgEUfQhMvvSsyNyPtiffnJo9IHdvFkjKx8uJBdOUXCjqW4EV34BaMKjN+XUyZGIi4zgulE+FyIi4TFcuW6dOnnXl0Rwz1RIooygbfx9srn7jmsrcxWC62Te398/5oEKcYkT3PD4ftx/T3+zw5uu4Nd3guvnQ8E9XvFca9euZTasesWMr3i+TnDdqKHbN3weLsIRXDeSLoLr14u7X1dn0hMX2kZYNzyvX++bLx4vKLhyHy1aNMrLy/5T/zuq4n31jbxrSiK4vyx+uuLcb+cdO9xXwn8Wfh35gUZ+APRz547MjhVcGaGVEVv3LP74n9j++r+Rd9cG3Pxs94MGQZRKILgILkGURDRr2jBPWuTrfSlPnDDUfvXt1xfBdZJ7+tAsc9f/6vpTFEKB8NfPHJ5l2rZplrO9UF1/PbxGWcoUBJFNv34hwW3U8MJIp4tbbu5p5xvb7f8bCS0kuPLVtIziSfnqbm0SC+5P300y2ze9EVvfF1wJOVcouA+PGRhJbZ0KsS8kuP4+foSC6+oWElyRaZdr3qyhXR7f927ss23VsokVwLjjSMgPQU5wzxyuvO5CdeNyYRu40oLryqMrnrX7axCfffBIrODu2TLF3Bk8Uz/Cc4frBFHsgeAiuARREiEfsI8+dEO0LqLn5ElCpEjquA9ikdvVv7yYk5PwBffkwVn2q3r/HP45p7x+d7S/Pyd33YpX8uqOfXCQXcqfiHL7+HVk9NnPFRLc4/tm2nL/vp2ibf5fNXD3XEhwXVnidEWd6giuf73hPFO/fii4Mu0jFFz/Wnf++Vas4Ibn9PPhFAX5il3yhQTXP9bPi56OcvKXNuLOIVIe5ty6SKEIrlxzeF0S4V+XkJw8AynLPFiXc8s4wfX3vRyC66bqSHz92YXzuZxMOYgTXAmZb+vqnaoQf5mz7dad6Lt1meMcXgdBFHMguAguQRA1FKFQEOlEll+Hf3fNMPM/fzwvTxDlHggugksQxGWMSRNutlMEwrmQxJUN+ZNfspRfpPKnMWQhZHTfTcWgDRJZDQQXwSUI4jLHjwsmmt+WPpeXJ65cyHQC+csEa5Zn8/1u3YqXzaL5T0Zztwkia4HgIrgEQRAEQRBlFQgugksQBEEQBFFWgeAiuARBEARBEGUVCC6CSxAEQRAEUVaB4CK4BEEQBEEQZRUILoJLEARBEARRVoHgZlRw5U/HEARBEARBlGMguBkUXA3z558JUwCJWLXqrFm4kHYEl87Zs7wXAWQB+rkOBDcBNDbQguCCFgQXIBvQz3UguAmgsYEWBBe0ILgA2YB+rgPBTQCNDbQguKAFwQXIBvRzHQhuAmhsoAXBBS0ILkA2oJ/rQHATQGMDLQguaEFwAbIB/VwHgpsAGhtoQXBBC4ILkA3o5zoQ3ATQ2EALggtaEFyAbEA/14HgJoDGBloQXNCC4AJkA/q5DgQ3ATQ20ILgghYEFyAb0M91ILgJoLGBFgQXtCC4ANmAfq4jdcE9f96YI0fOl0RIYwtzxRonToRP+spz/Hj+dWU9li8/axYsKJ12dKXi+PGw9Vx5Tp0qjfeiw4dL670IIG3CNlkqUUr9PIxiIFXBlRdv377zRA1FmiOFcu7wegiiqli8+GzYjK4IJ08a8803tNeaDEaiIA2WLDmb1xaJKxdp9/tUBXft2nN5D4S4vHH6dPjUa54DB/KvgyCqE0eOhK2p5uEH7ZqP9evPhY8doMZZtIi+nWasWZPOoIUjVcHdvBnBrelIY6pCeA0EUd04eDBsTTUPglvzIe/1AFeaH35gBDfNSLvfI7hlHgguUUqB4JZnpP1BB9kEwU030u73CG6ZB4JLlFIguOUZaX/QQTZBcNONtPs9glvmgeASpRQIbnlG2h90kE0Q3HQj7X6P4JZ5ILhEKQWCW56R9gcdZBMEN91Iu98juGUeCC5RSoHglmek/UEH2QTBTTfS7vcIbpkHgkuUUiC45Rlpf9BBNkFw0420+z2CW+aB4BKlFAhueUbaH3SQTRDcdCPtfo/glnkguEQpBYJbnpH2Bx1kEwQ33Ui73yO4ZR4ILlFKgeCWZ6T9QQfZBMFNN9Lu9whumQeCS5RSILjlGWl/0EE2QXDTjbT7PYJb5oHgEqUUCG55RtofdJBNENx0I+1+j+CWeSC4RCkFgluekfYHHWQTBDfdSLvfI7hlHgguUUqB4JZnpP1BB9kEwU030u73CG5FfPzxN+axxyaZ5557LSf/zTc/m/79B5n//GeGXZc6Ybi8v1+4nmYUo+D6z2/x4pV527Xx009rc86xefOBvDpxUatWrbycixde+E9e7lLi8cefzmkfu3adNl9//WO0Xqjt/PXXodjr+/zzRXafSZNeNnv3VvansI36x/zllw1m4MCbzCOPPJF3LInLdZ9xUeje/Mii4IavVaHnFPf6l0qk/UEH2aQqwXV97VLe8y5nX2zbtn1e7tFHnzKDBw81K1b8nbetJmP27C/zcppIu98juPsqG5Mr161b1+zefabiQ+9nc/vt99icEwcXYeOuV6+eWbt2V8HtaUYxCu7lfD5xx/rgg7nmjz925OUvFnHHkujV65qC25JE585d7dI/VsOGjXLWC52nkOBOnPiS2br1SHSszZv3FzyWrI8f/0zeMcI6I0bclZe/1PjnnxMVEn/KlqUf3XzzrXl1/Mii4LoIX68wLra9mCPtDzrIJlUJrt+f5HM/3F5VXM6+GApu3br1orIMvoX1azLkvho1apyXv9RIu98juPtyBXflyr/N1Kmz7Wjujh3H8+pKhI37jjvuqZakpBGlILgdO3bOy8sbjqyvXbvTrn/xxSL7g4fk6tSpY3NDh46w6+HxCgmu5ML627YdtetNmzbLO44LyT/88Pic3LffLrP52rVr59Tr1KmLXc6b91PscWS5adM+s3Dhr1HOP+/IkXfb5ejRY22+c+dudt0JbrNmze3yzz8P2rwvuBL+txD+cT/++FvzzTe/5FxPGDt3njSffrog7znIPcozX7hweZTbs+esrVenzoUPhkaNGpnWrdva/BdfLLY5d3/umOGxw0Bwc9f9nP8MFyyobH/Nm7fI23fHjhN2vWHDhlGuXr36eT+oX8lI+4MOskl1BXfUqAeisghn2Pdc/bj3MVf+++/Dtly/foOcbc8++6pdymeDy1933QCbE4ENBTc8r4u2bdvZbe+994Vdf/HF/0b1x42baNav3513jN69r7PlW2+9M9rWsmWriveNlqZbt+5557j77jE55+/T5zqzceNem5P3dv/4N9xws11OmfJe3nFcpN3vEdx9uYLboEFD++EtZXnxBg8ellc/bICDBt1kG8GwYSNjt6cZxSq4mzbttyHrIrj+yJ7//FxZBPfGG4fa8vbtxyLhjHvWIriSd+HyDRpceOPp0aN33v5xxxIpcFNUunS5Osr7Yusk72LH8n8ydyMGcu/vvPOJLcv0BWl7Mm1hwoRnbW727K/M8uWb80ZwXdkJ7rZtx3KuKbyGxo0v/lO5q//QQ+Mr7vtCHwi3y/OPy8flXnttejSCKyFvrP45w0BwC5f95ZIlq235zjvvtz+k/fzzerN06dpo+zPPTI7K8sF71133553vSkbaH3SQTS4muG4gZcyYR/O2S7gBB78/+utx/VSiQ4eOUc79YNmxY6XgykDNiBGVwilSGgruP/+ctPt99NG8KPfAA+OigQz5YVWWIrht2rSL6rj3f+nvsu+yZRv/fztn9BrFFYXxf8sHU0n7IJWCYqkQMBqSWmh9sIqlpaC+tMQnUQoRomIqVR+aINGXWGMSQ2JagzUkWqyUFtqAGPPkQx+6wWm+Wc7smTOzm82aeDJ3vg9+7MydO3dmZ+be8829dzdpE/bu/SjateuD5Jz08QQxvPfu/Ro9e7YUL8PgyrSFq1eHc7+3dDjl4V3vaXCXqwa3re2d1Qeg+lBa7ANh1zGnEZ/ygNntnmxVg6vXpQc3b/upU73xJwzuwsI/SboYYlsWqNeDe+nS9WR5x45sz1deWXgukC5IOsyo3U9vP3Tos0xZ2mQgL+bePn9eNX9ogKShOH36bOqYmF9rDa703MHg4kXh9u2ZaHy82iusjyHLaNzkxa0e+piYdmPL2L272gCeO9efypv3/WXZGtw9ez7MHFdDg1tbrnd9dT4EsLm5v+puX1z8N7XuhXego8qptQyuLB858kU0M/MkXsYQvdS7Awd6MnllHfFet6mN6iyQ9t+aaWtwheHh0VQ5tmwYXD3KLOkSR+w+sl13tGjy8sLg2jz6E8B827IE73pPg7uc7sHNw3bB65sLxOACPDx2uydFN7hybWFwnz6tzXNuxeDq+9iMwUWvqE5DwyQNGoZn7H46rx7OEfQQ1fbtbZnpDbL/6Ogv0ezs76l9rcGVRkxPUbDnr9dhhPCjBb1dMzU1H0/PsfvqMmTo7datidy39rxraQ3uzp3vZ/bT0OBml22ava9icPFM45nFFCu9D+qQ5/QE4B3oqHKqWYMLMOUNo7GY4iNpjQyuTW9vf6/hMcTgDgz8GM3P/52k1zO4en97fFA1uLVzRU+rfqE9eLAnHg20+0nnhQajQHnT22Bw0aNs0/X57N/flSlP8K73NLjL+QYXN+3GjdFkrpveZte1we3q+jiz3ZMiGtxjx75aNW7frb5R/5bkbWRwrZmFwT1zpi82VwBDNkjPM7gYosJ8WAzp2PPC+tTUQioNc3XlE8PC+JeNixevJfnR44x0W5Zsl2V7PBjGjo7OVF70KIyMTMfrYnCvXBmMe2plX21w8TaPRjrveACGGmkYgjp//vvUNpv36NEv43JPnvw27q3Gd8L8X9mORrK//4f4Hyt0j4Et7/79J1FPz6fxvbR58qDBrS53dnbH8+Hwrxd6uNPm0wYX6GCJZwfB1O7jgXego8qptQzu0NBPq23qUFI/0C6jIwPtHdpLMbho7xBX7tz5OdkXn5huIKNpaAeRB21ed/cnqXzAjuA9frwYxxFrcNH5gZh04cK1aNu26nQE+f3Jw4d/RH19A3GaNbigvf3deAqZPg7akMHBkWTaW57Bte3DzZtj0eTkXGxwcR0weoo8J058k+RHDH706M/Mvhrvek+D24AXL/5L9T4Vka1ocJsBPU55b5954MdRNm09tHKPe3vPRktLlVTPmFR0mXZgqTc0VA+UkzetoJXz1eCNfD09ejgHIHO4dHoz54LGWY7XqDEEZTa4Flyz9T7ba11fL7wDHVVONTK49UB7ldfuIh3YdJtnI+IWtuW10bo3tVkaHWctZIqCLaMW6xqX7V3vaXADp6gGd6sjb8OaZswFfj1r07Yyly/Xer2b+X6NyJu2YaHBbR38BRx6VGz6VsA70FHlVCsGl9Swc3CFZmOBd72nwQ0cGtzNAcPzNm3fvo5MWggcP/516m9mNhMa3NY4fPjzNf8GzhPvQEeVUzS4b0a9f19pNtZ513sa3MChwSVFggY3TLwDHVVO0eD64l3vaXADhwaXFAka3DDxDnRUOUWD64t3vafBDRwaXFIkaHDDxDvQUeUUDa4v3vWeBjdwaHBJkaDBDRPvQEeVUzS4vnjXexrcwKHBJUWCBjdMvAMdVU7R4PriXe9pcAOHBpcUCRrcMPEOdFQ5RYPri3e9p8ENHBpcUiRocMPEO9BR5RQNri/e9Z4GN3BocEmRoMENE+9AR5VTNLi+eNd7GtzAocElRYIGN0y8Ax1VTtHg+uJd72lwA4cGlxQJGtww8Q50VDlFg+uLd72nwQ0cGlxSJGhww8Q70FHlFA2uL9713tXgjo0xsGwmL1++tpf8rahSocklrbGyYp+mzdfdu5VoaSl7LmTjePDA4cZSpRdfXn2Bx/OUq8F99ep1/ABOTq6QDWZ8vBLNzPgFlenpSjQxwXtLmqP6rPg1hrOzK3FjbM+LvDliMijqbQsvzPQYPuC6w+N5ytXgUhRFURRFUdRGiwaXoiiKoiiKCko0uBRFURRFUVRQosGlKIqiKIqighINLkVRFEVRFBWUaHApiqIoiqKooESDS1EURVEURQWl/wEx7T5i5NPLJAAAAABJRU5ErkJggg==>