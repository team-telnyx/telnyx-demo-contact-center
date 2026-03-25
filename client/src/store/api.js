import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth?.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQuery = async (args, api, extraOptions) => {
  try {
    const result = await rawBaseQuery(args, api, extraOptions);
    if (result.error) {
      const status = result.error.status;
      if (status === 'PARSING_ERROR' || status === 'FETCH_ERROR') {
        return { error: { status, data: result.error.data || 'Network error' } };
      }
    }
    return result;
  } catch (err) {
    return { error: { status: 'FETCH_ERROR', data: err.message || 'Network error' } };
  }
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ['Agents', 'QueueCalls', 'Conversations', 'Messages', 'CallHistory', 'MyNumbers', 'IvrFlows', 'Recordings', 'AdminUsers', 'AdminMetrics', 'AdminReports', 'AdminSettings', 'AudioFiles'],
  endpoints: (builder) => ({
    // Agents
    getAgents: builder.query({
      query: () => '/users/agents',
      providesTags: ['Agents'],
    }),

    // Queue / Voice
    getQueueCalls: builder.query({
      query: () => '/voice/queue',
      providesTags: ['QueueCalls'],
    }),
    acceptCall: builder.mutation({
      query: (body) => ({
        url: '/voice/accept-call',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['QueueCalls'],
    }),
    transferCall: builder.mutation({
      query: (body) => ({
        url: '/voice/transfer',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['QueueCalls'],
    }),
    warmTransfer: builder.mutation({
      query: (body) => ({
        url: '/voice/warm-transfer',
        method: 'POST',
        body,
      }),
    }),
    completeWarmTransfer: builder.mutation({
      query: (body) => ({
        url: '/voice/complete-warm-transfer',
        method: 'POST',
        body,
      }),
    }),
    getConferenceStatus: builder.query({
      query: (callControlId) => `/voice/conference-status/${callControlId}`,
    }),

    // Conversations
    getMyConversations: builder.query({
      query: (username) => `/conversations/assignedTo/${username}`,
      providesTags: ['Conversations'],
    }),
    getUnassignedConversations: builder.query({
      query: () => '/conversations/unassignedConversations',
      providesTags: ['Conversations'],
    }),

    // Messages
    getMessages: builder.query({
      query: (conversationId) => `/conversations/conversationMessages/${conversationId}`,
      providesTags: ['Messages'],
    }),
    sendMessage: builder.mutation({
      query: (body) => ({
        url: '/conversations/composeMessage',
        method: 'POST',
        body,
      }),
      // No invalidatesTags - we use socket events for real-time updates
    }),

    // Phone numbers
    getAgentPhoneNumbers: builder.query({
      query: (tag) => `/users/phone-numbers?tag=${tag}`,
      providesTags: ['Agents'],
    }),
    getMessagingNumbers: builder.query({
      query: () => '/users/messaging-numbers',
    }),

    // Recordings
    getRecordings: builder.query({
      query: (filters = {}) => {
        const { page = 1, size = 20, ...rest } = filters;
        const params = new URLSearchParams({ page, size });
        Object.entries(rest).forEach(([k, v]) => { if (v) params.append(k, v); });
        return `/voice/recordings?${params.toString()}`;
      },
      providesTags: ['Recordings'],
    }),
    deleteRecording: builder.mutation({
      query: (id) => ({ url: `/voice/recordings/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Recordings'],
    }),

    // Call Events (Debug)
    getCallEvents: builder.query({
      query: (filters = {}) => {
        const { page = 1, size = 25, ...rest } = filters;
        const params = new URLSearchParams({ page, size });
        Object.entries(rest).forEach(([k, v]) => { if (v) params.append(k, v); });
        return `/voice/call-events?${params.toString()}`;
      },
    }),

    // Call History
    getCallHistory: builder.query({
      query: ({ page = 1, limit = 50, direction, status } = {}) => {
        const params = new URLSearchParams({ page, limit });
        if (direction) params.append('direction', direction);
        if (status) params.append('status', status);
        return `/voice/calls?${params.toString()}`;
      },
      providesTags: ['CallHistory'],
    }),

    // IVR Flows
    getIvrFlows: builder.query({
      query: () => '/ivr',
      providesTags: ['IvrFlows'],
    }),
    getIvrFlow: builder.query({
      query: (id) => `/ivr/${id}`,
      providesTags: ['IvrFlows'],
    }),
    createIvrFlow: builder.mutation({
      query: (body) => ({ url: '/ivr', method: 'POST', body }),
      invalidatesTags: ['IvrFlows'],
    }),
    updateIvrFlow: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/ivr/${id}`, method: 'PUT', body }),
      invalidatesTags: ['IvrFlows'],
    }),
    deleteIvrFlow: builder.mutation({
      query: (id) => ({ url: `/ivr/${id}`, method: 'DELETE' }),
      invalidatesTags: ['IvrFlows'],
    }),
    publishIvrFlow: builder.mutation({
      query: ({ id, phoneNumber }) => ({ url: `/ivr/${id}/publish`, method: 'POST', body: { phoneNumber } }),
      invalidatesTags: ['IvrFlows'],
    }),
    unpublishIvrFlow: builder.mutation({
      query: (id) => ({ url: `/ivr/${id}/unpublish`, method: 'POST' }),
      invalidatesTags: ['IvrFlows'],
    }),
    getConnectionNumbers: builder.query({
      query: () => '/ivr/connection-numbers',
    }),
    getVoices: builder.query({
      query: () => '/ivr/voices',
    }),

    // Admin User Management
    getAdminUsers: builder.query({
      query: ({ page = 1, size = 20 } = {}) => `/admin/users?page=${page}&size=${size}`,
      providesTags: ['AdminUsers'],
    }),
    getAdminUser: builder.query({
      query: (id) => `/admin/users/${id}`,
      providesTags: ['AdminUsers'],
    }),
    createAdminUser: builder.mutation({
      query: (body) => ({ url: '/admin/users', method: 'POST', body }),
      invalidatesTags: ['AdminUsers', 'Agents'],
    }),
    updateAdminUser: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/users/${id}`, method: 'PUT', body }),
      invalidatesTags: ['AdminUsers', 'Agents'],
    }),
    deleteAdminUser: builder.mutation({
      query: (id) => ({ url: `/admin/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminUsers', 'Agents'],
    }),

    // Admin Settings
    getOrgSettings: builder.query({
      query: () => '/admin/settings',
      providesTags: ['AdminSettings'],
    }),
    updateOrgSettings: builder.mutation({
      query: (body) => ({ url: '/admin/settings', method: 'PUT', body }),
      invalidatesTags: ['AdminSettings'],
    }),

    // Admin Metrics & Reports
    getAgentMetrics: builder.query({
      query: () => '/admin/metrics/agents',
      providesTags: ['AdminMetrics'],
    }),
    getCallReports: builder.query({
      query: ({ startDate, endDate, agentUsername, queueName } = {}) => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (agentUsername) params.append('agentUsername', agentUsername);
        if (queueName) params.append('queueName', queueName);
        return `/admin/reports/calls?${params.toString()}`;
      },
      providesTags: ['AdminReports'],
    }),

    // Audio Files
    getAudioFiles: builder.query({
      query: () => '/audio',
      providesTags: ['AudioFiles'],
    }),
    uploadAudioFile: builder.mutation({
      query: (formData) => ({
        url: '/audio',
        method: 'POST',
        body: formData,
        formData: true,
      }),
      invalidatesTags: ['AudioFiles'],
    }),
    deleteAudioFile: builder.mutation({
      query: (filename) => ({
        url: `/audio/${encodeURIComponent(filename)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AudioFiles'],
    }),
    createAudioBucket: builder.mutation({
      query: () => ({
        url: '/audio/create-bucket',
        method: 'POST',
      }),
    }),

    // User data
    getUserData: builder.query({
      query: (username) => `/users/user_data/${username}`,
    }),
    updateProfile: builder.mutation({
      query: ({ username, ...body }) => ({
        url: `/users/update/${username}`,
        method: 'PUT',
        body,
      }),
    }),

    // Phone Number Management (user's own API key)
    getMyNumbers: builder.query({
      query: ({ page = 1, size = 20 } = {}) => `/users/my-numbers?page=${page}&size=${size}`,
      providesTags: ['MyNumbers'],
    }),
    searchAvailableNumbers: builder.query({
      query: ({ country_code = 'US', state, city, limit = 20 }) => {
        const params = new URLSearchParams({ country_code, limit });
        if (state) params.append('state', state);
        if (city) params.append('city', city);
        return `/users/available-numbers?${params.toString()}`;
      },
    }),
    purchaseNumber: builder.mutation({
      query: (body) => ({
        url: '/users/purchase-number',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MyNumbers'],
    }),
    releaseNumber: builder.mutation({
      query: (numberId) => ({
        url: `/users/release-number/${numberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['MyNumbers'],
    }),
    assignNumber: builder.mutation({
      query: (body) => ({
        url: '/users/assign-number',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MyNumbers'],
    }),
    unassignNumber: builder.mutation({
      query: (body) => ({
        url: '/users/unassign-number',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MyNumbers'],
    }),
    assignMessagingProfile: builder.mutation({
      query: (body) => ({
        url: '/users/assign-messaging-profile',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MyNumbers'],
    }),
    unassignMessagingProfile: builder.mutation({
      query: (body) => ({
        url: '/users/unassign-messaging-profile',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MyNumbers'],
    }),
    updateNumber: builder.mutation({
      query: (body) => ({
        url: '/users/update-number',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['MyNumbers'],
    }),
  }),
});

export const {
  useGetAudioFilesQuery,
  useUploadAudioFileMutation,
  useDeleteAudioFileMutation,
  useCreateAudioBucketMutation,
  useGetOrgSettingsQuery,
  useUpdateOrgSettingsMutation,
  useGetAdminUsersQuery,
  useGetAdminUserQuery,
  useCreateAdminUserMutation,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useGetAgentMetricsQuery,
  useGetCallReportsQuery,
  useGetAgentsQuery,
  useGetQueueCallsQuery,
  useAcceptCallMutation,
  useTransferCallMutation,
  useWarmTransferMutation,
  useCompleteWarmTransferMutation,
  useGetMyConversationsQuery,
  useGetUnassignedConversationsQuery,
  useGetMessagesQuery,
  useSendMessageMutation,
  useGetAgentPhoneNumbersQuery,
  useGetConferenceStatusQuery,
  useGetCallHistoryQuery,
  useGetUserDataQuery,
  useUpdateProfileMutation,
  useGetMyNumbersQuery,
  useSearchAvailableNumbersQuery,
  usePurchaseNumberMutation,
  useReleaseNumberMutation,
  useAssignNumberMutation,
  useUnassignNumberMutation,
  useAssignMessagingProfileMutation,
  useUnassignMessagingProfileMutation,
  useUpdateNumberMutation,
  useGetIvrFlowsQuery,
  useGetIvrFlowQuery,
  useCreateIvrFlowMutation,
  useUpdateIvrFlowMutation,
  useDeleteIvrFlowMutation,
  usePublishIvrFlowMutation,
  useUnpublishIvrFlowMutation,
  useGetConnectionNumbersQuery,
  useGetVoicesQuery,
  useGetMessagingNumbersQuery,
  useGetRecordingsQuery,
  useGetCallEventsQuery,
  useDeleteRecordingMutation,
} = api;
