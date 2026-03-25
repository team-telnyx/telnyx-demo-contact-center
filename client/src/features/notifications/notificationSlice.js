import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  callBadge: 0,
  smsBadge: 0,
  unreadConversations: [],
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
    markConversationUnread(state, action) {
      const id = action.payload;
      if (!state.unreadConversations.includes(id)) {
        state.unreadConversations.push(id);
      }
    },
    markConversationRead(state, action) {
      const id = action.payload;
      state.unreadConversations = state.unreadConversations.filter((c) => c !== id);
    },
  },
});

export const { incrementCallBadge, clearCallBadge, incrementSmsBadge, clearSmsBadge, markConversationUnread, markConversationRead } = notificationSlice.actions;
export default notificationSlice.reducer;
