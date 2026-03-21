import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { login, logout } from '../features/auth/authSlice';

// Mock jwt-decode
vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn((token) => {
    // Return decoded payload based on the token
    if (token === 'valid-test-token') {
      return {
        username: 'testuser',
        role: 'agent',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar.png',
      };
    }
    return {};
  }),
}));

// Mock fetch globally
global.fetch = vi.fn();

const createStore = (preloadedState) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: preloadedState ? { auth: preloadedState } : undefined,
  });

describe('authSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = createStore();
      const state = store.getState().auth;

      expect(state.token).toBeNull();
      expect(state.username).toBeNull();
      expect(state.role).toBeNull();
      expect(state.firstName).toBeNull();
      expect(state.lastName).toBeNull();
      expect(state.avatarUrl).toBeNull();
      expect(state.isOnline).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear all state back to initial values', () => {
      const store = createStore({
        token: 'some-token',
        username: 'testuser',
        role: 'admin',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar.png',
        isOnline: true,
        isLoading: false,
        error: null,
      });

      store.dispatch(logout());

      const state = store.getState().auth;
      expect(state.token).toBeNull();
      expect(state.username).toBeNull();
      expect(state.role).toBeNull();
      expect(state.isOnline).toBe(false);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('login.pending', () => {
    it('should set isLoading to true and clear error', () => {
      const store = createStore({
        token: null,
        username: null,
        role: null,
        firstName: null,
        lastName: null,
        avatarUrl: null,
        isOnline: false,
        isLoading: false,
        error: 'Previous error',
      });

      store.dispatch(login.pending('requestId'));

      const state = store.getState().auth;
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('login.fulfilled', () => {
    it('should set token and user data from decoded JWT', () => {
      const store = createStore();

      store.dispatch(
        login.fulfilled({ token: 'valid-test-token' }, 'requestId', {
          username: 'testuser',
          password: 'pass',
        })
      );

      const state = store.getState().auth;
      expect(state.token).toBe('valid-test-token');
      expect(state.username).toBe('testuser');
      expect(state.role).toBe('agent');
      expect(state.firstName).toBe('Test');
      expect(state.lastName).toBe('User');
      expect(state.avatarUrl).toBe('https://example.com/avatar.png');
      expect(state.isOnline).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(window.localStorage.setItem).toHaveBeenCalledWith('token', 'valid-test-token');
    });
  });

  describe('login.rejected', () => {
    it('should set error and stop loading', () => {
      const store = createStore({
        token: null,
        username: null,
        role: null,
        firstName: null,
        lastName: null,
        avatarUrl: null,
        isOnline: false,
        isLoading: true,
        error: null,
      });

      store.dispatch(login.rejected(null, 'requestId', { username: 'test', password: 'pass' }, 'Invalid credentials'));

      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
      expect(state.token).toBeNull();
    });

    it('should use default error message when no payload', () => {
      const store = createStore();

      store.dispatch(login.rejected(new Error('fail'), 'requestId', { username: 'test', password: 'pass' }));

      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Login failed');
    });
  });
});
