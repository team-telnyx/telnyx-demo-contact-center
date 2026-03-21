import { z } from 'zod';

const acceptCallSchema = z.object({
  sipUsername: z.string().min(1, 'SIP username is required'),
  callControlId: z.string().min(1, 'Call control ID is required'),
  callerId: z.string().min(1, 'Caller ID is required'),
});

const transferSchema = z.object({
  sipUsername: z.string().min(1, 'SIP username is required'),
  callerId: z.object({
    number: z.string().min(1, 'Caller ID number is required'),
  }).passthrough(),
  callControlId: z.string().optional(),
  outboundCCID: z.string().optional(),
});

const warmTransferSchema = z.object({
  callControlId: z.string().optional(),
  sipUsername: z.string().min(1, 'SIP username is required'),
  callerId: z.object({
    number: z.string().min(1, 'Caller ID number is required'),
  }).passthrough(),
  outboundCCID: z.string().optional(),
  webrtcOutboundCCID: z.string().min(1, 'WebRTC outbound CCID is required'),
});

export { acceptCallSchema, transferSchema, warmTransferSchema };
