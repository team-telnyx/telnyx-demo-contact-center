export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'agent';
  avatar?: string;
  status?: string;
  extension?: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  tags?: string[];
}

export interface Queue {
  id: string;
  name: string;
  description?: string;
  strategy?: string;
  maxWait?: number;
  priority?: number;
}

export interface Recording {
  id: string;
  callId: string;
  agentId: string;
  url: string;
  duration?: number;
  transcription?: string;
  sentiment?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerType: string;
  triggerConfig?: Record<string, any>;
  actions: WorkflowAction[];
}

export interface WorkflowAction {
  type: string;
  config: Record<string, any>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
