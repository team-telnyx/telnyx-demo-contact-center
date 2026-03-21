import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { jwtDecode } from 'jwt-decode';

const API_BASE = `https://${process.env.NEXT_PUBLIC_API_HOST || process.env.REACT_APP_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT || process.env.REACT_APP_API_PORT}`;

export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || error || 'Login failed');
      }

      return await response.json();
    } catch (err) {
      return rejectWithValue(err.message || 'Network error');
    }
  }
);

export const setAgentStatus = createAsyncThunk(
  'auth/setAgentStatus',
  async ({ username, status }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const response = await fetch(`${API_BASE}/api/users/update-status/${username}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to toggle status');
      }

      return await response.json();
    } catch (err) {
      return rejectWithValue(err.message || 'Network error');
    }
  }
);

// Fetch full profile data after hydrating from token
export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      if (!auth.username || !auth.token) return rejectWithValue('No user');
      const response = await fetch(`${API_BASE}/api/users/user_data/${auth.username}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!response.ok) return rejectWithValue('Failed to fetch profile');
      return await response.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const initialState = {
  token: null,
  username: null,
  role: null,
  firstName: null,
  lastName: null,
  avatarUrl: null,
  agentStatus: 'offline',
  isLoading: false,
  error: null,
  telnyxApiKey: null,
  telnyxPublicKey: null,
  appConnectionId: null,
  webrtcConnectionId: null,
  onboardingComplete: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      localStorage.removeItem('token');
      Object.assign(state, initialState);
    },
    hydrateFromToken(state) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwtDecode(token);
          state.token = token;
          state.username = decoded.username || null;
        } catch {
          localStorage.removeItem('token');
        }
      }
    },
    setProfile(state, action) {
      const p = action.payload;
      if (p.firstName !== undefined) state.firstName = p.firstName;
      if (p.lastName !== undefined) state.lastName = p.lastName;
      if (p.avatarUrl !== undefined) state.avatarUrl = p.avatarUrl;
      if (p.telnyxApiKey !== undefined) state.telnyxApiKey = p.telnyxApiKey;
      if (p.telnyxPublicKey !== undefined) state.telnyxPublicKey = p.telnyxPublicKey;
      if (p.appConnectionId !== undefined) state.appConnectionId = p.appConnectionId;
      if (p.webrtcConnectionId !== undefined) state.webrtcConnectionId = p.webrtcConnectionId;
      if (p.onboardingComplete !== undefined) state.onboardingComplete = p.onboardingComplete;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        const { token, firstName, lastName, avatarUrl, agentStatus, telnyxApiKey, telnyxPublicKey, appConnectionId, webrtcConnectionId } = action.payload;
        localStorage.setItem('token', token);
        const decoded = jwtDecode(token);
        state.token = token;
        state.username = decoded.username || null;
        state.firstName = firstName || null;
        state.lastName = lastName || null;
        state.avatarUrl = avatarUrl || null;
        state.agentStatus = agentStatus || 'online';
        state.telnyxApiKey = telnyxApiKey || null;
        state.telnyxPublicKey = telnyxPublicKey || null;
        state.appConnectionId = appConnectionId || null;
        state.webrtcConnectionId = webrtcConnectionId || null;
        state.onboardingComplete = !!action.payload.onboardingComplete;
        state.isLoading = false;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Login failed';
      })
      .addCase(setAgentStatus.fulfilled, (state, action) => {
        state.agentStatus = action.payload.status;
      })
      .addCase(setAgentStatus.rejected, (state, action) => {
        state.error = action.payload || 'Failed to toggle status';
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        const { firstName, lastName, avatar, status, onboardingComplete } = action.payload;
        state.firstName = firstName || state.firstName;
        if (onboardingComplete !== undefined) state.onboardingComplete = !!onboardingComplete;
        state.lastName = lastName || state.lastName;
        state.avatarUrl = avatar || state.avatarUrl;
        state.agentStatus = status || state.agentStatus;
      });
  },
});

export const { logout, hydrateFromToken, setProfile } = authSlice.actions;
export { setAgentStatus as toggleStatus }; // backwards-compat alias
export default authSlice.reducer;
