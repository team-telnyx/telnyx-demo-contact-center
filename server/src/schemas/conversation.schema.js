import { z } from 'zod';

const sendMessageSchema = z.object({
  From: z.string().min(1, 'From number is required'),
  To: z.string().min(1, 'To number is required'),
  Text: z.string().min(1, 'Message text is required'),
});

const assignAgentSchema = z.object({
  conversation_id: z.string().min(1, 'Conversation ID is required'),
  user: z.string().min(1, 'User is required'),
});

export { sendMessageSchema, assignAgentSchema };
