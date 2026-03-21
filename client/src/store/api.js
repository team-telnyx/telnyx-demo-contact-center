import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseQuery = fetchBaseQuery({
  baseUrl: `https://${process.env.NEXT_PUBLIC_API_HOST || process.env.REACT_APP_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT || process.env.REACT_APP_API_PORT}/api`,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Agents', 'QueueCalls', 'Conversations', 'Messages', 'CallHistory', 'MyNumbers', 'IvrFlows'],
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
  }),
});

export const {
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
  useGetIvrFlowsQuery,
  useGetIvrFlowQuery,
  useCreateIvrFlowMutation,
  useUpdateIvrFlowMutation,
  useDeleteIvrFlowMutation,
  usePublishIvrFlowMutation,
  useUnpublishIvrFlowMutation,
  useGetConnectionNumbersQuery,
  useGetMessagingNumbersQuery,
} = api;
