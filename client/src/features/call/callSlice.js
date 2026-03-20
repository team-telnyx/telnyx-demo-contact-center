import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  dialNumber: '',
  callState: 'idle',
  clientStatus: 'NOT READY',
  direction: null,
  callerInfo: null,
  callControlId: null,
  outboundCCID: null,
  webrtcOutboundCCID: null,
  isConferenceActive: false,
  conferenceId: null,
  warmTransferActive: false,
  warmTransferError: null,
  thirdPartyCallControlId: null,
  isMuted: false,
  isHeld: false,
  callDuration: 0,
  startTime: null,
  toNumber: null,
  fromNumber: null,
  callerNumber: '',
};

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    dialDigit(state, action) {
      state.dialNumber += action.payload;
    },
    backspace(state) {
      state.dialNumber = state.dialNumber.slice(0, -1);
    },
    clearDial(state) {
      state.dialNumber = '';
    },
    setCallState(state, action) {
      state.callState = action.payload;
    },
    setClientStatus(state, action) {
      state.clientStatus = action.payload;
    },
    setDirection(state, action) {
      state.direction = action.payload;
    },
    setCallerInfo(state, action) {
      state.callerInfo = action.payload;
    },
    setIsMuted(state, action) {
      state.isMuted = action.payload;
    },
    setIsHeld(state, action) {
      state.isHeld = action.payload;
    },
    setCallDuration(state, action) {
      state.callDuration = action.payload;
    },
    setStartTime(state, action) {
      state.startTime = action.payload;
    },
    setToNumber(state, action) {
      state.toNumber = action.payload;
    },
    setFromNumber(state, action) {
      state.fromNumber = action.payload;
    },
    setCallerNumber(state, action) {
      state.callerNumber = action.payload;
    },
    resetCall(state) {
      Object.assign(state, {
        ...initialState,
        dialNumber: state.dialNumber,
        clientStatus: state.clientStatus,
        callerNumber: state.callerNumber,
      });
    },
    setOutboundCCID(state, action) {
      state.outboundCCID = action.payload;
    },
    setWebrtcOutboundCCID(state, action) {
      state.webrtcOutboundCCID = action.payload;
    },
    setCallControlId(state, action) {
      state.callControlId = action.payload;
    },
    setConference(state, action) {
      state.isConferenceActive = action.payload.isActive;
      state.conferenceId = action.payload.conferenceId || null;
    },
    setWarmTransfer(state, action) {
      state.warmTransferActive = action.payload.active;
      state.thirdPartyCallControlId = action.payload.thirdPartyCallControlId || null;
      state.warmTransferError = action.payload.error || null;
    },
  },
});

export const {
  dialDigit,
  backspace,
  clearDial,
  setCallState,
  setClientStatus,
  setDirection,
  setCallerInfo,
  setIsMuted,
  setIsHeld,
  setCallDuration,
  setStartTime,
  setToNumber,
  setFromNumber,
  setCallerNumber,
  resetCall,
  setCallControlId,
  setOutboundCCID,
  setWebrtcOutboundCCID,
  setConference,
  setWarmTransfer,
} = callSlice.actions;

export default callSlice.reducer;
