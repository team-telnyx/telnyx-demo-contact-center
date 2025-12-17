import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Use NEXT_PUBLIC_API_URL if available (for production/Workers),
// otherwise construct from HOST/PORT (for local development)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (() => {
  const protocol = (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_HTTPS === 'true') ? 'https' : 'http';
  const port = process.env.NEXT_PUBLIC_API_PORT ? `:${process.env.NEXT_PUBLIC_API_PORT}` : '';
  return `${protocol}://${process.env.NEXT_PUBLIC_API_HOST}${port}/api`;
})();

interface LoginCredentials {
  username: string;
  password: string;
}

interface UserData {
  username: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: string;
  status?: string;
}

interface TransferData {
  callControlId: string;
  to: string;
}

interface MessageData {
  to: string;
  body: string;
  from?: string;
}

class ApiService {
  private client: AxiosInstance;

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
        // Only log important requests, skip SSE polling
        if (!config.url?.includes('/events/') && !config.url?.includes('/queue')) {
          console.log('🟠 [axios] Request:', config.method?.toUpperCase(), config.url);
        }
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        console.error('🔴 [axios] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Handle auth errors
    this.client.interceptors.response.use(
      (response) => {
        // Only log important responses, skip SSE polling
        if (!response.config.url?.includes('/events/') && !response.config.url?.includes('/queue')) {
          console.log('🟠 [axios] Response:', response.status, response.config.url);
        }
        return response;
      },
      (error) => {
        console.error('🔴 [axios] Response error:', error.response?.status, error.config?.url);
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          console.warn('⚠️ [axios] 401 Unauthorized - Redirecting to login');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // User Authentication
  async login(credentials: LoginCredentials): Promise<any> {
    const response = await this.client.post('/users/login', credentials);
    return response.data;
  }

  async register(userData: UserData): Promise<any> {
    const response = await this.client.post('/users/register', userData);
    return response.data;
  }

  async logout(): Promise<any> {
    const response = await this.client.post('/users/logout');
    return response.data;
  }

  // User Management
  async getUserData(username: string): Promise<any> {
    const response = await this.client.get(`/users/user_data/${username}`);
    return response.data;
  }

  async getAgents(): Promise<any> {
    const response = await this.client.get('/users/agents');
    return response.data;
  }

  async updateUser(username: string, userData: UserData): Promise<any> {
    const response = await this.client.put(`/users/update/${username}`, userData);
    return response.data;
  }

  async updateUserStatus(username: string, status: string): Promise<any> {
    const response = await this.client.patch(`/users/update-status/${username}`, { status });
    return response.data;
  }

  async getSipCredentials(): Promise<any> {
    const response = await this.client.get('/users/sip-credentials');
    return response.data;
  }

  async getDashboardMetrics(): Promise<any> {
    const response = await this.client.get('/users/dashboard-metrics');
    return response.data;
  }

  // Voice/Call Management - Now using polling instead of websockets
  async getQueueData(): Promise<any> {
    const response = await this.client.get('/voice/queue');
    return response.data;
  }

  async getMyActiveSession(): Promise<any> {
    const response = await this.client.get('/voice/my-active-session');
    return response.data;
  }

  async acceptCall(sipUsername: string): Promise<any> {
    console.log('🟡 [apiService] acceptCall STARTED');
    console.log('🟡 [apiService] sipUsername:', sipUsername);
    console.log('🟡 [apiService] API_BASE_URL:', API_BASE_URL);

    try {
      // No longer requires specific call data - automatically picks next call from queue
      console.log('🟡 [apiService] Making POST request to /voice/accept-call');
      const response = await this.client.post('/voice/accept-call', {
        sipUsername
      });
      console.log('🟡 [apiService] Response received:', response);
      console.log('🟡 [apiService] Response status:', response.status);
      console.log('🟡 [apiService] Response data:', response.data);
      console.log('🟡 [apiService] Response headers:', response.headers);

      return response.data;
    } catch (error: any) {
      console.error('🔴 [apiService] acceptCall ERROR:', error);
      console.error('🔴 [apiService] Error response:', error.response);
      console.error('🔴 [apiService] Error message:', error.message);
      throw error;
    }
  }

  async transferCall(sipUsername: string, callerId: any, callControlId: string, outboundCCID?: string): Promise<any> {
    const response = await this.client.post('/voice/transfer', {
      sipUsername,
      callerId,
      callControlId,
      outboundCCID
    });
    return response.data;
  }

  async hangUpCall(callControlId: string): Promise<any> {
    const response = await this.client.post('/voice/hangup-call', { callControlId });
    return response.data;
  }

  // Telnyx Proxy Endpoints
  async getAgentsWithTag(tag: string, page = 1, size = 20): Promise<any> {
    const response = await this.client.get('/telnyx/phone-numbers', {
      params: { tag, page, size }
    });
    return response.data;
  }

  // Number Management
  async getAllPhoneNumbers(page = 1, size = 100): Promise<any> {
    const response = await this.client.get('/telnyx/all-phone-numbers', {
      params: { page, size }
    });
    return response.data;
  }

  async getAvailablePhoneNumbers(page = 1, size = 100): Promise<any> {
    const response = await this.client.get('/telnyx/available-phone-numbers', {
      params: { page, size }
    });
    return response.data;
  }

  async assignNumber(phoneNumberId: string, sipUsername: string, phoneNumber: string): Promise<any> {
    const response = await this.client.post('/telnyx/assign-number', {
      phoneNumberId,
      sipUsername,
      phoneNumber
    });
    return response.data;
  }

  async unassignNumber(phoneNumberId: string, phoneNumber: string): Promise<any> {
    const response = await this.client.post('/telnyx/unassign-number', {
      phoneNumberId,
      phoneNumber
    });
    return response.data;
  }

  // Conversations
  async getConversations(): Promise<any> {
    const response = await this.client.get('/conversations');
    return response.data;
  }

  async sendMessage(messageData: MessageData): Promise<any> {
    const response = await this.client.post('/conversations/send', messageData);
    return response.data;
  }

  async markAsRead(conversationId: string): Promise<any> {
    const response = await this.client.patch(`/conversations/${conversationId}/read`);
    return response.data;
  }

  // Telnyx Number Management (New Flow)
  async searchPhoneNumbers(filters: any): Promise<any> {
    const response = await this.client.get('/telnyx/available-numbers', { params: filters });
    return response.data;
  }

  async purchasePhoneNumber(data: { phoneNumber: string, connectionId: string, username: string }): Promise<any> {
    const response = await this.client.post('/telnyx/purchase-number', data);
    return response.data;
  }

  // Error handling helper
  handleApiError(error: any): never {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      console.error('API Error:', errorData);

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
      console.error('Network Error:', error.request);
      throw new Error('Network error - please check your connection');
    } else {
      console.error('Request Error:', error.message);
      throw new Error('Request failed - please try again');
    }
  }
}

export default new ApiService();