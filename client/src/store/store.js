import { configureStore } from '@reduxjs/toolkit';
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

export default store;
