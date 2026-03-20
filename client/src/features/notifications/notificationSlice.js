import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  callBadge: 0,
  smsBadge: 0,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    incrementCallBadge(state) {
      state.callBadge += 1;
    },
    clearCallBadge(state) {
      state.callBadge = 0;
    },
    incrementSmsBadge(state) {
      state.smsBadge += 1;
    },
    clearSmsBadge(state) {
      state.smsBadge = 0;
    },
  },
});

export const { incrementCallBadge, clearCallBadge, incrementSmsBadge, clearSmsBadge } = notificationSlice.actions;
export default notificationSlice.reducer;
