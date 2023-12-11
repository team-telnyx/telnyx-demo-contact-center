const express = require('express');
const Voice = require('../models/Voice');
const dotenv = require('dotenv');
const telnyx = require('telnyx')(dotenv.config().parsed.TELNYX_API);
const router = express.Router();
const axios = require('axios');
const { broadcast } = require('./websocket'); 
const e = require('express');

//================================================ ADD INBOUND CALL TO QUEUE ================================================

router.post('/webhook', express.json(), (req, res) => {
  const data = req.body.data;
  const direction = data.payload.direction;
  const call = new telnyx.Call({ call_control_id: data.payload.call_control_id });
  if (data.event_type === 'call.initiated' && direction === 'incoming') {
    Voice.create({
      queue_uuid: data.payload.call_control_id, // call_control_id of the enqueued call
      telnyx_number: data.payload.to, // 'to' number on inbound call
      destination_number: data.payload.from, // 'from' number on inbound call
      direction: data.payload.direction // set the direction as 'inbound' for now
    }).then(() => {
      console.log('Call saved to database');
    }).catch(error => {
      console.error('Error saving call to database:', error);
    });
    call.answer();
  }
  // broadcast the call status to the client
  
  if (data.event_type === 'call.answered') {
    call.enqueue({queue_name: 'General_Queue'})
      .then(response => {
        console.log('Call Enqueued:', response.data);
      });
  }
  if (data.event_type === 'call.enqueued') {
    broadcast('NEW_CALL', data);
    console.log('Call Enqueued:', data.payload.call_control_id);
    call.playback_start({audio_url: 'http://com.twilio.music.classical.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3'});
    Voice.update({
      queue_name: data.payload.queue // queue name
    },{
      where: { queue_uuid: data.payload.call_control_id }
    }).then(() => {
      console.log('Call saved to database');
    }).catch(error => {
      console.error('Error saving call to database:', error);
    });
  }
  res.status(200).send('OK');
});
router.get('/queue', async (req, res) => {
  try {
    const response = await axios.get('https://api.telnyx.com/v2/queues/General_Queue/calls', {
      headers: {
        'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
      }
    });
    res.send(response.data);
  } catch (error) {
    console.error('Error retrieving queue calls:', error);
    res.status(500).send('Internal Server Error');
  }

});

//================================================ AGENT ACCEPT CALL FROM QUEUE ================================================

// Typical dial and bridge call flow
// First I dial the agent's sip username. I add the call control id of the original queued call as a param to the webhook url
router.post('/accept-call', express.json(), async (req, res) => {
  console.log('Request Body:', req.body);
  const { sipUsername, callControlId, callerId } = req.body;
  const webhookUrlWithParam = `https://${dotenv.config().parsed.APP_HOST}:${dotenv.config().parsed.APP_PORT}/api/voice/outbound?callControlId_Bridge=${encodeURIComponent(callControlId)}`;

  try {
    const telnyxRequestBody = {
      connection_id: '1446442091122001881', // Replace with your connection ID
      to: `sip:${sipUsername}@sip.telnyx.com`,
      from: callerId,
      webhook_url: webhookUrlWithParam,
    };

    // Set up the authorization header with your Telnyx API key
    const config = {
      headers: {
        'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`,
        'Content-Type': 'application/json'
      }
    };

    // Make the HTTP POST request to Telnyx API
    const telnyxResponse = await axios.post('https://api.telnyx.com/v2/calls', telnyxRequestBody, config);
    console.log('Call Dialed');
    Voice.update({
      accept_agent: sipUsername, // Agent SIP username who accepted the call
    }, {
      where: {
        queue_uuid: callControlId // call_control_id of the enqueued call
      }
    }).then(() => {
      console.log('Database record updated with agent who accepted the call');
      res.status(200).send('OK');
    }).catch(error => {
      console.error('Error updating database:', error);
      res.status(500).send('Error updating database');
    });
  } catch (error) {
    console.error('Error during transfer or bridging call:', error);
    res.status(500).send('Internal Server Error');
  }
});

// I then bridge the agent's call to the original queued call

router.post('/outbound', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const callControl = req.body.data.payload.call_control_id;
  const callControlId_Bridge = req.query.callControlId_Bridge;
  const hangup_source = req.body.data.payload.hangup_source;
  const clientState = req.body.data.payload.client_state;

  console.log("OUTBOUND:", req.body.data);
  console.log("BRIDGE ID", callControlId_Bridge);
  if (event_type === 'call.answered') {
    try {
      const bridgeResponse = await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/bridge`, {
        call_control_id:callControl,
        park_after_unbridge: 'self',
      }, {
        headers: {
          'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
        }
      });
      if (event_type === 'call.bridged') {
      console.log('Call Bridged');
      }
      Voice.update({
        bridge_uuid: callControl // call_control_id of the outbound call
      }, {
        where: {
          queue_uuid: callControlId_Bridge // call_control_id of the enqueued call
        }
      }).then(() => {
        console.log('Database record updated with bridge call details');
        res.status(200).send('OK'); // Move this inside the then block
      }).catch(error => {
        console.error('Error updating database:', error);
        res.status(500).send('Error updating database'); // Handle error response here
      });      
    } catch (error) {
      console.error('Error during call bridging:', error);
      res.status(500).send('Internal Server Error');
    }
    
  }
  if (event_type === 'call.hangup' && hangup_source === "callee" && clientState !== Buffer.from("Warm Transfer").toString('base64')) {
    try {
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/hangup`, {}, {
          headers: {
            'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
          }
        });
      console.log('Call Hung Up');
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error hanging up call TEST:', error);
      res.status(500).send('Internal Server Error');
    }
   }
 });

//=================================================== AGENT COLD TRANSFER ===================================================

// This is when the agent transfers the call to another agent via transfer button in the PhonePage component
router.post('/transfer', express.json(), async (req, res) => {
  const { sipUsername, callerId, callControlId, outboundCCID } = req.body;

  let transferId;
  let isCallControlIdUsed = false;
  console.log("outbound CCID", outboundCCID);
  console.log("call control ID", callControlId);
  console.log("COLD TRANSFER", req.body.data)
  if (outboundCCID && outboundCCID.length > 0) {
    // If outboundCCID is populated, use it for the transfer
    transferId = outboundCCID;
  } else if (callControlId) {
    // If callControlId is populated, use it to fetch queueUuid from the database
    isCallControlIdUsed = true;
    const callData = await Voice.findOne({
      where: { bridge_uuid: callControlId }
    });
    if (callData) {
      transferId = callData.queue_uuid;
    } else {
      return res.status(404).send('Call data not found');
    }
  } else {
    return res.status(400).send('No valid ID provided for transfer');
  }
  const callControlFlag = isCallControlIdUsed ? `&isCallControlIdUsed=true` : '';
  console.log("transfer ID", transferId);
  try {
    const response = await axios.post(`https://api.telnyx.com/v2/calls/${transferId}/actions/transfer`, {
      webhook_url: `https://${dotenv.config().parsed.APP_HOST}:${dotenv.config().parsed.APP_PORT}/api/voice/transfer-call?callControlId_Bridge=${transferId}${callControlFlag}`,
      from: callerId.number,
      to: `sip:${sipUsername}@sip.telnyx.com`,
      client_state: Buffer.from("Transfer").toString('base64')
    }, {
      headers: {
        'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
      }
    });

    console.log(response.data);
    res.send(response.data);
  } catch (error) {
    console.error('Error transferring call:', error);
    res.status(500).send('Internal Server Error');
  }
});


router.post('/transfer-call', express.json(), async (req, res) => {

  res.status(200).send('OK');
  try {
    const event_type = req.body.data.event_type;
    const callControlId_Bridge = req.query.callControlId_Bridge;
    const isCallControlIdUsed = req.query.isCallControlIdUsed === 'true';
    const hangup_source = req.body.data.payload.hangup_source;
    const sipcode = req.body.data.payload.sip_hangup_cause;
    const call_control = req.body.data.payload.call_control_id;
    const webhook = req.body.data.payload;
    let callData;
    let transferId;
    console.log("Call Object", webhook)
    console.log("call Control Bridge", callControlId_Bridge)
    console.log("Is Call Control ID Used", isCallControlIdUsed);
    //if true don't lookup in database - inbound call
    //if false lookup in database - outbound call
    if (!isCallControlIdUsed) {
      callData = await Voice.findOne({ where: { bridge_uuid: callControlId_Bridge } });
      transferId = callData ? callData.queue_uuid : null;
    } else {
      transferId = callControlId_Bridge;
    }
    if (!transferId) {
      console.error('Transfer ID not found');
    }

    if (event_type === 'call.answered' && isCallControlIdUsed === false) {
      try {
        await axios.post(`https://api.telnyx.com/v2/calls/${transferId}/actions/hangup`, {}, {
          headers: {
            'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
          }
        });
        broadcast('OutboundCCID', null);
        console.log('WebRTC Call Hung Up');
      } catch (error) {
        console.error('Error hanging up call answer:', error);
      }
    }
    if (event_type === 'call.hangup' && hangup_source === "callee" && isCallControlIdUsed === true) {
      broadcast('OutboundCCID', null);
      try {
        await axios.post(`https://api.telnyx.com/v2/calls/${transferId}/actions/hangup`, {}, {
          headers: {
            'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
           }
         });
        console.log('Call Hung Up INBOUND', call_control);
      } catch (error) {
        console.error('Error hanging up call hangup:', error);
      }
    } 
    
    if (event_type === 'call.hangup' && (sipcode === "480" || sipcode === "486") && isCallControlIdUsed === true) {
      broadcast('OutboundCCID', null);
      try {
        // Play a message
        await axios.post(`https://api.telnyx.com/v2/calls/${transferId}/actions/speak`, {
          payload: 'The agent is not available. Transferring you back into the queue',
          voice: 'female',
          language: 'en-US'
        }, {
          headers: {
            'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
          }
        });

        // Enqueue the call
        await axios.post(`https://api.telnyx.com/v2/calls/${transferId}/actions/enqueue`, {
          queue_name: 'General_Queue'
        }, {
          headers: {
            'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
          }
        });
        console.log('Call Enqueued');
      } catch (error) {
        console.error('Error processing call:', error);
      }
    }
//does not work for outbound calls
    if (event_type === 'call.hangup' && (sipcode === "480" || sipcode === "486") && isCallControlIdUsed === false) {
      broadcast('OutboundCCID', null);
      try {
        // Play a message
        await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/speak`, {
          payload: 'The agent is not available. Transferring you into the queue',
          voice: 'female',
          language: 'en-US'
        }, {
          headers: {
            'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
          }
        });

        // Enqueue the call
        await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/enqueue`, {
          queue_name: 'General_Queue'
        }, {
          headers: {
            'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
          }
        });

        await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/playback_start`, {
          audio_url: 'http://com.twilio.music.classical.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3'
        }, {
          headers: {
            'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
          }
        });

        await axios.post(`https://api.telnyx.com/v2/calls/${transferId}/actions/hangup`, {}, {
          headers: {
            'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
          }
        });
        console.log('Call Enqueued');
      } catch (error) {
        console.error('Error processing call:', error);
      }
    }
  
  }

    catch (error) {
    console.error('Error processing webhook:', error);
    }
  });

//=================================================== AGENT WARM TRANSFER ===================================================

router.post('/warm-transfer', express.json(), async (req, res) => {
  const { callControlId, sipUsername, callerId, outboundCCID, webrtcOutboundCCID } = req.body;
  console.log("WARM TRANSFER", req.body);
  let queueUuid;
  if (callControlId) {
  const callData = await Voice.findOne({
    where: { bridge_uuid: callControlId } //works for inbound calls only callControlId and outbound is outboundCCID
  });
  if (callData) {
    queueUuid = callData.queue_uuid;
  }
}
else if (!callControlId) {
  const callData = await Voice.findOne({
    where: { bridge_uuid: outboundCCID } //works for inbound calls only callControlId and outbound is outboundCCID
  });
  if (callData) {
    queueUuid = callData.queue_uuid;
  }
}
  console.log("webrtc outbound CCID", webrtcOutboundCCID)
  console.log("outbound CCID", outboundCCID);
  console.log("caller ID for warm", callerId.number)
  console.log("sip username for warm:", sipUsername)
  //console.log("call control ID for warm:", callControlId)
  console.log("queue uuid for warm:", queueUuid)
  try {
    //Create a conference
    if (callControlId) {
    const conference = await createConference(callControlId); // callControlId = inbound and webrtcOutboundCCID = outbound - need logic to determine which is which and pass the correct call_control_id
    console.log('Conference created:', conference.data.id);
    // Update the database with the conference ID
    await Voice.update(
      { conference_id: conference.data.id },
      { where: { bridge_uuid: callControlId } } // callControlId = inbound and outboundCCID = outbound - need logic to determine which is which and pass the correct call_control_id
    );
    //inbound calls
    
      console.log("INBOUND CALL")
      const inboundQueueHold = await axios.post(`https://api.telnyx.com/v2/conferences/${conference.data.id}/actions/join`, {
        hold: true,
        hold_audio_url: 'http://com.twilio.music.classical.s3.amazonaws.com/oldDog_-_endless_goodbye_%28instr.%29.mp3',
        call_control_id: queueUuid, //callControlId = inbound and outboundCCID = outbound - need logic to determine which is which and pass the correct call_control_id
        client_state: Buffer.from("External").toString('base64'),
        end_conference_on_exit: false
      }, {
        headers: {
          'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
        }
      });
      console.log('Inbound Call on hold', inboundQueueHold.data);

      // Dial the warm transfer agent and pass the conference ID
    const webhookUrlWithParam = `https://${dotenv.config().parsed.APP_HOST}:${dotenv.config().parsed.APP_PORT}/api/voice/outbound-warm?conferenceID=${encodeURIComponent(conference.data.id)}`;
    await telnyx.calls.create({
      connection_id: '1446442091122001881', // Replace with your connection ID
      to: `sip:${sipUsername}@sip.telnyx.com`,
      from: callerId.number,
      webhook_url: webhookUrlWithParam,
    });
    console.log('Warm Transfer Agent Dialed');

    res.status(200).send('OK');
    }
    //if callControlId is populated, use it to fetch queueUuid from the database
    else if (!callControlId) {
    console.log("OUTBOUND CALL")
    console.log("outbound CCID", outboundCCID)
    console.log("queue UUID", queueUuid)
    const conference = await createConference(outboundCCID); // callControlId = inbound and webrtcOutboundCCID = outbound - need logic to determine which is which and pass the correct call_control_id
    console.log('Conference created:', conference.data.id);
    // Update the database with the conference ID
    await Voice.update(
      { conference_id: conference.data.id },
      { where: { bridge_uuid: outboundCCID } } // callControlId = inbound and outboundCCID = outbound - need logic to determine which is which and pass the correct call_control_id
    );

    const outboundQueueHold = await axios.post(`https://api.telnyx.com/v2/conferences/${conference.data.id}/actions/hold`, {
      audio_url: 'http://com.twilio.music.classical.s3.amazonaws.com/oldDog_-_endless_goodbye_%28instr.%29.mp3',
      call_control_ids: [queueUuid]
    }, {
      headers: {
        'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
      }
    });
    console.log('Outbound call on hold', outboundQueueHold.data);
  
    const updateClientState = await axios.put(`https://api.telnyx.com/v2/calls/${outboundCCID}/actions/client_state_update`, {
      client_state: Buffer.from("External").toString('base64')
    }, {
      headers: {
        'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
      }
    });
    console.log('Client state updated', updateClientState.data);

    // Dial the warm transfer agent and pass the conference ID
    const webhookUrlWithParam = `https://${dotenv.config().parsed.APP_HOST}:${dotenv.config().parsed.APP_PORT}/api/voice/outbound-warm?conferenceID=${encodeURIComponent(conference.data.id)}`;
    await telnyx.calls.create({
      connection_id: '1446442091122001881', // Replace with your connection ID
      to: `sip:${sipUsername}@sip.telnyx.com`,
      from: callerId.number,
      webhook_url: webhookUrlWithParam,
    });
    console.log('Warm Transfer Agent Dialed');

    res.status(200).send('OK');
  }} catch (error) {
    console.error('Error handling warm transfer:', error); //error.response.data
    res.status(500).send('Internal Server Error');
  }
});

router.post('/outbound-warm', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const callControl = req.body.data.payload.call_control_id;
  const conferenceId = req.query.conferenceID;
  console.log("Outbound Warm", req.body.data)
  if (event_type === 'call.answered') {
    try {
      // Add the call to the conference
      await addCallToConference(callControl, conferenceId); //callControl = inbound and 
      console.log('Agent added to conference');
    } catch (error) {
      console.error('Error during call bridging:', error);
      res.status(500).send('Internal Server Error');
    }
    res.status(200).send('OK');
  }
});
//check if the conference is created so that I can update my front end button to enable the complete warm transfer button
router.get('/conference-status/:callControlId', async (req, res) => {
  try {
    const callData = await Voice.findOne({
      where: { bridge_uuid: req.params.callControlId }
    });
    const isConferenceCreated = callData && callData.conference_id != null;
    res.json({ isConferenceCreated });
  } catch (error) {
    console.error('Error fetching conference status:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Add a route for the ability to complete the warm transfer by unholding the queue call
router.post('/complete-warm-transfer', express.json(), async (req, res) => {
  const { callControlId, outboundCCID } = req.body;
  console.log("UNHOLD", req.body.callControlId)
  console.log("UNHOLD ALL", req.body)
  const callData = await Voice.findOne({
    where: { bridge_uuid: callControlId }
  });
  if (callData) {
    conferenceId = callData.conference_id;
    queueId = callData.queue_uuid;
  }
  
  try {
    // Unhold the queue call
    const unholdResponse = await axios.post(`https://api.telnyx.com/v2/conferences/${conferenceId}/actions/unhold`, {
      call_control_ids: [queueId],
    }, {
      headers: {
        'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
      }
    });
    console.log('Call unheld', unholdResponse.data);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error unholding call:', error);
    res.status(500).send('Internal Server Error');
  }
});

async function createConference(callControlId) {
  try {
    const conferenceName = 'conf-' + Date.now();  // Using current timestamp to generate a unique conference name
    const conferenceParameters = {
        call_control_id: callControlId,
        client_state: Buffer.from("Warm Transfer").toString('base64'),
        name: conferenceName,
        beep_enabled: 'always',
        start_conference_on_create: true
    };
    const response = await telnyx.conferences.create(conferenceParameters);
    return response;
  } catch (error) {
    console.error('Error creating conference:', error);
    throw error;  // re-throw the error to be handled by the calling function
  }
}

const addCallToConference = async (callControlId, conferenceId) => {
  const telnyxApiUrl = `https://api.telnyx.com/v2/conferences/${conferenceId}/actions/join`;
  const joinConferenceParameters = {
    call_control_id: callControlId,
  };

  try {
    // Set up the authorization header with your Telnyx API key
    const config = {
      headers: {
        'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`, // Ensure you have your Telnyx API key in your environment variables
        'Content-Type': 'application/json'
      }
    };

    // Make the HTTP POST request to join the conference
    await axios.post(telnyxApiUrl, joinConferenceParameters, config);
    console.log(`Call with ID ${callControlId} added to conference ${conferenceId}`);
    return true;
  } catch (error) {
    console.error('Error adding call to conference:', error);
    throw error; // re-throw the error to be handled by the calling function
  }
};
//============= PARK OUTBOUND CALLS FUNCTIONALITY ===================
// This is when the webrtc user dials an outbound number from the PhonePage component and the call is parked via /outbound-webrtc
router.post('/outbound-webrtc', express.json(), async (req, res) => {
  const fromNumber = req.body.data.payload.from;
  const toNumber = req.body.data.payload.to;
  const callControlId = req.body.data.payload.call_control_id;
  const event_type = req.body.data.event_type;
  const direction = req.body.data.payload.direction;
  const state = req.body.data.payload.state;
  const clientState = req.body.data.payload.client_state;
  const data = req.body.data;
  // base64 encode the client state
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
    }
  };

  try {
    // Answer the call using the Telnyx API
    if (event_type === 'call.initiated' && direction === 'outgoing' && state === 'parked') {
      broadcast('WebRTC_OutboundCCID', req.body.data.payload.call_control_id);
      console.log("WEBRTC OUTBOUND CCID", req.body.data.payload.call_control_id)
        Voice.create({
          telnyx_number: data.payload.from, // 'to' number on inbound call
          destination_number: data.payload.to, // 'from' number on inbound call
          direction: data.payload.direction, // set the direction as 'inbound' for now
          queue_uuid: data.payload.call_control_id, // call_control_id of the webrtc call leg
        }).then(() => {
          console.log('Call saved to database');
        }).catch(error => {
          console.error('Error saving call to database:', error);
        });
      const answerData = {
        client_state: Buffer.from(callControlId).toString('base64'),
      };
      const response = await axios.post(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, answerData, config);
      console.log('WebRTC Call Answered');
    }
    if (event_type === 'call.answered' && clientState === Buffer.from(callControlId).toString('base64')) {
      const transferId = req.body.data.payload.call_control_id;
      console.log("WEBRTC ANSWER OUTBOUND CCID", transferId)
      const telnyxRequestBody = {
        connection_id: '1446442091122001881', // Replace with your connection ID
        to: toNumber,
        from: fromNumber,
        client_state: Buffer.from(transferId).toString('base64'),
        webhook_url: `https://${dotenv.config().parsed.APP_HOST}:${dotenv.config().parsed.APP_PORT}/api/voice/outbound-webrtc-bridge?callControlId_Bridge=${transferId}`,
      };
  
      // Make the HTTP POST request to Telnyx API
      const telnyxResponse = await axios.post('https://api.telnyx.com/v2/calls', telnyxRequestBody, config);
      console.log(telnyxResponse.data)
      console.log('Outbound Call Dialed');
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    if (error.response) {
      // Log more detailed response error
      console.error('Error response data:', error.response.data);
    }
  }
  // Always respond with 200 OK
  res.status(200).send('OK');
});

//============= PARK OUTBOUND CALLS FUNCTIONALITY - BRIDGE LEG ===================
// This is when the webrtc user dials an outbound number from the PhonePage component and the call is parked via /outbound-webrtc. This is the second leg to the PSTN
router.post('/outbound-webrtc-bridge', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const direction = req.body.data.payload.direction;
  const state = req.body.data.payload.state;
  const callControlId_Bridge = req.query.callControlId_Bridge;
  const callControl = req.body.data.payload.call_control_id;
  const hangup_source = req.body.data.payload.hangup_source;
  const clientState = req.body.data.payload.client_state;

  if (event_type === 'call.answered') {
    broadcast('OutboundCCID', req.body.data.payload.call_control_id);
    try {
      const bridgeResponse = await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/bridge`, {
        call_control_id:callControl,
        park_after_unbridge: 'self',
      }, {
        headers: {
          'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
        }
      });
      
      if (event_type === 'call.bridged') {
      console.log('Call Bridged');
      }
      Voice.update({
        bridge_uuid: callControl // call_control_id of the outbound call
      }, {
        where: {
          queue_uuid: callControlId_Bridge // call_control_id of the enqueued call
        }
      }).then(() => {
        console.log('Database record updated with bridge call details');
        res.status(200).send('OK'); // Move this inside the then block
      }).catch(error => {
        console.error('Error updating database:', error);
        res.status(500).send('Error updating database'); // Handle error response here
      });      
    } catch (error) {
      console.error('Error during call bridging:', error);
      res.status(500).send('Internal Server Error');
    }
    
  }
  console.log("CALL CONTROL CLIENT STATE", clientState);
  if (event_type === 'call.hangup' && hangup_source === "callee" && clientState !== Buffer.from("Transfer").toString('base64')) {
    console.log("WEBRTC HANGUP")
    try {
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/hangup`, {}, {
      headers: {
        'Authorization': `Bearer ${dotenv.config().parsed.TELNYX_API}`
      }
    });
    broadcast('OutboundCCID', null);
    console.log('Call Hung Up');
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error hanging up call outbound:', error);
    res.status(500).send('Internal Server Error');
  }
  }
});

module.exports = router