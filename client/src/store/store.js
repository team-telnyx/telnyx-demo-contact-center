import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from '../features/auth/authSlice';
import callReducer from '../features/call/callSlice';
import socketReducer from '../features/socket/socketSlice';
import notificationReducer from '../features/notifications/notificationSlice';
import { api } from './api';
import { socketMiddleware } from './socketMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    call: callReducer,
    socket: socketReducer,
    notifications: notificationReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware, socketMiddleware),
});

// Enable refetchOnFocus and refetchOnReconnect
setupListeners(store.dispatch);

export default store;
