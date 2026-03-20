import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connected: false,
  reconnecting: false,
  error: null,
};

const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    connected(state) {
      state.connected = true;
      state.reconnecting = false;
      state.error = null;
    },
    disconnected(state) {
      state.connected = false;
      state.reconnecting = false;
    },
    reconnecting(state) {
      state.reconnecting = true;
    },
    error(state, action) {
      state.error = action.payload;
    },
  },
});

export const {
  connected,
  disconnected,
  reconnecting,
  error,
} = socketSlice.actions;

export default socketSlice.reducer;
