import axios from 'axios';

// Use HTTPS if explicitly enabled or in production
const protocol = (process.env.NODE_ENV === 'production' || process.env.REACT_APP_HTTPS === 'true') ? 'https' : 'http';
const API_BASE_URL = `${protocol}://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api`;

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests if available
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // User Authentication
  async login(credentials) {
    const response = await this.client.post('/users/login', credentials);
    return response.data;
  }

  async register(userData) {
    const response = await this.client.post('/users/register', userData);
    return response.data;
  }

  async logout() {
    const response = await this.client.post('/users/logout');
    return response.data;
  }

  // User Management
  async getUserData(username) {
    const response = await this.client.get(`/users/user_data/${username}`);
    return response.data;
  }

  async getAgents() {
    const response = await this.client.get('/users/agents');
    return response.data;
  }

  async updateUser(username, userData) {
    const response = await this.client.put(`/users/update/${username}`, userData);
    return response.data;
  }

  async updateUserStatus(username, status) {
    const response = await this.client.patch(`/users/update-status/${username}`, { status });
    return response.data;
  }

  async getSipCredentials() {
    const response = await this.client.get('/users/sip-credentials');
    return response.data;
  }

  async getDashboardMetrics() {
    const response = await this.client.get('/users/dashboard-metrics');
    return response.data;
  }

  // Voice/Call Management
  async getQueueData() {
    const response = await this.client.get('/voice/queue');
    return response.data;
  }

  async getMyActiveSession() {
    const response = await this.client.get('/voice/my-active-session');
    return response.data; // { session, legs } or { session: null }
  }

  async acceptCall(callData) {
    const response = await this.client.post('/voice/accept-call', callData);
    return response.data;
  }

  async transferCall(transferData) {
    const response = await this.client.post('/voice/transfer', transferData);
    return response.data;
  }

  async hangUpCall(callControlId) {
    const response = await this.client.post('/voice/hangup-call', { callControlId });
    return response.data;
  }

  // Warm transfer methods removed

  // Telnyx Proxy Endpoints (moved from client-side)
  async getAgentsWithTag(tag, page = 1, size = 20) {
    const response = await this.client.get('/telnyx/phone-numbers', {
      params: { tag, page, size }
    });
    return response.data;
  }

  // Conversations
  async getConversations() {
    const response = await this.client.get('/conversations');
    return response.data;
  }

  async sendMessage(messageData) {
    const response = await this.client.post('/conversations/send', messageData);
    return response.data;
  }

  async markAsRead(conversationId) {
    const response = await this.client.patch(`/conversations/${conversationId}/read`);
    return response.data;
  }

  // Error handling helper
  handleApiError(error) {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const errorData = error.response.data;
      
      console.error('API Error:', errorData);
      
      // Provide more specific error messages based on status code
      switch (status) {
        case 404:
          throw new Error(errorData.message || 'Resource not found');
        case 401:
          throw new Error('Authentication failed - please log in again');
        case 403:
          throw new Error('Access denied - insufficient permissions');
        case 500:
          throw new Error('Server error - please try again later');
        case 503:
          throw new Error('Service temporarily unavailable');
        default:
          throw new Error(errorData.message || `Server error (${status})`);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error:', error.request);
      throw new Error('Network error - please check your connection');
    } else {
      // Something else happened
      console.error('Request Error:', error.message);
      throw new Error('Request failed - please try again');
    }
  }
}

export default new ApiService();
