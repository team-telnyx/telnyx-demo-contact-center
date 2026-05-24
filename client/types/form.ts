// Form field types matching the server schema
export interface FormSchema {
  version: number;
  pages: FormPage[];
  actions?: FormAction[];
}

export interface FormPage {
  id: string;
  title: string;
  sections: FormSection[];
}

export interface FormSection {
  id: string;
  type: string;
  title: string;
  props: Record<string, any>;
  fields: FormField[];
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  variable: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  validation?: FieldValidation;
  props: Record<string, any>;
}

export interface FieldValidation {
  required?: boolean;
  requiredMessage?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  customRules?: CrossFieldRule[];
}

export interface CrossFieldRule {
  type: 'crossField';
  fieldVariable: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt';
  message: string;
}

export interface FormAction {
  id: string;
  label: string;
  type: 'submit' | 'workflow';
  variant?: string;
  workflowId?: string | null;
}

export interface FormSettings {
  requireApproval?: boolean;
  approvalRoles?: string[];
  allowMultipleSubmissions?: boolean;
  notificationEmails?: string[];
  notificationWebhook?: string | null;
  submissionLimit?: number | null;
  schedule?: FormSchedule;
  publicLink?: FormPublicLink;
  multiLanguage?: FormMultiLanguage;
  calculatedFields?: CalculatedField[];
  repeatableSections?: string[];
}

export interface FormSchedule {
  enabled: boolean;
  startDate?: string | null;
  endDate?: string | null;
  timezone?: string;
}

export interface FormPublicLink {
  enabled: boolean;
  slug?: string;
  requireAuth?: boolean;
  allowedDomains?: string[];
}

export interface FormMultiLanguage {
  enabled: boolean;
  defaultLanguage: string;
  translations?: Record<string, Record<string, string>>;
}

export interface CalculatedField {
  variable: string;
  label?: string;
  formula: string;
  format: 'number' | 'currency' | 'percent';
}

export interface Form {
  id: string;
  name: string;
  description?: string;
  schema: FormSchema;
  variables?: Record<string, any>;
  enabled: boolean;
  createdBy?: string;
  updatedBy?: string;
  version?: number;
  category?: string;
  tags?: string[];
  settings?: FormSettings;
  createdAt?: string;
  updatedAt?: string;
  _count?: { submissions: number; versions: number; approvals: number };
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, any>;
  prefilledContext?: Record<string, any>;
  submittedBy?: string;
  workflowExecutionId?: string;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'changes_requested';
  version?: number;
  duration?: number;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormVersion {
  id: string;
  formId: string;
  version: number;
  schema: FormSchema;
  variables?: Record<string, any>;
  changeNote?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  schema: FormSchema;
  variables?: Record<string, any>;
  isBuiltIn?: boolean;
  usageCount?: number;
  icon?: string;
}

export interface FormApproval {
  id: string;
  formSubmissionId: string;
  formId: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  requestedBy: string;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueBy?: string;
}

export interface FormAnalytics {
  totalSubmissions: number;
  approvedCount: number;
  rejectedCount: number;
  avgDuration?: number;
  submissionsOverTime: { date: string; count: number }[];
  fieldAnalytics: Record<string, { fillRate: number; topValues: string[] }>;
  approvalStats?: {
    pending: number;
    approved: number;
    rejected: number;
    avgApprovalTime?: number;
  };
}
