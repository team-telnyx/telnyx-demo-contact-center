/**
 * Form field types configuration.
 * Defines all available field types with their icons, default props, and categories.
 */

import {
  Type, Mail, Phone, AlignLeft, List, CheckSquare, CircleDot,
  SlidersHorizontal, ToggleLeft, Calendar, Clock, Image, User,
  Hash, DollarSign, Link, LayoutGrid, Star, Flag, Tag
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface FieldCategory {
  label: string;
  color: string;
}

export interface FieldTypeDefinition {
  label: string;
  icon: LucideIcon;
  category: string;
  defaultProps: Record<string, any>;
}

export const FIELD_CATEGORIES: Record<string, FieldCategory> = {
  input: { label: 'Input Fields', color: 'blue' },
  selection: { label: 'Selection Fields', color: 'green' },
  media: { label: 'Media & Display', color: 'purple' },
  layout: { label: 'Layout Blocks', color: 'orange' },
};

export const FIELD_TYPES: Record<string, FieldTypeDefinition> = {
  // Input fields
  text: { label: 'Text Input', icon: Type, category: 'input', defaultProps: { placeholder: 'Enter text...' } },
  email: { label: 'Email', icon: Mail, category: 'input', defaultProps: { placeholder: 'email@example.com' } },
  phone: { label: 'Phone', icon: Phone, category: 'input', defaultProps: { placeholder: '+1 (555) 000-0000' } },
  textarea: { label: 'Long Text', icon: AlignLeft, category: 'input', defaultProps: { placeholder: 'Enter details...', rows: 4 } },
  number: { label: 'Number', icon: Hash, category: 'input', defaultProps: { min: 0, max: 100 } },
  currency: { label: 'Currency', icon: DollarSign, category: 'input', defaultProps: { currency: 'USD' } },
  url: { label: 'URL', icon: Link, category: 'input', defaultProps: { placeholder: 'https://' } },

  // Selection fields
  select: { label: 'Dropdown', icon: List, category: 'selection', defaultProps: { options: ['Option 1', 'Option 2', 'Option 3'] } },
  multiselect: { label: 'Multi-Select', icon: LayoutGrid, category: 'selection', defaultProps: { options: ['Option 1', 'Option 2', 'Option 3'] } },
  checkbox: { label: 'Checkbox', icon: CheckSquare, category: 'selection', defaultProps: {} },
  radio: { label: 'Radio Group', icon: CircleDot, category: 'selection', defaultProps: { options: ['Option 1', 'Option 2', 'Option 3'] } },
  slider: { label: 'Slider', icon: SlidersHorizontal, category: 'selection', defaultProps: { min: 0, max: 100, step: 1 } },
  switch: { label: 'Switch', icon: ToggleLeft, category: 'selection', defaultProps: {} },
  rating: { label: 'Rating', icon: Star, category: 'selection', defaultProps: { max: 5 } },
  flag: { label: 'Priority Flag', icon: Flag, category: 'selection', defaultProps: { levels: ['low', 'medium', 'high', 'critical'] } },

  // Date/time
  date: { label: 'Date', icon: Calendar, category: 'input', defaultProps: {} },
  time: { label: 'Time', icon: Clock, category: 'input', defaultProps: {} },
  datetime: { label: 'Date & Time', icon: Calendar, category: 'input', defaultProps: {} },

  // Media & Display
  avatar: { label: 'Avatar', icon: User, category: 'media', defaultProps: { size: 64 } },
  image: { label: 'Image', icon: Image, category: 'media', defaultProps: { width: '100%', height: 200 } },
  badge: { label: 'Badge', icon: Tag, category: 'media', defaultProps: { variant: 'default', color: 'blue' } },
  hero: { label: 'Hero Section', icon: Star, category: 'media', defaultProps: { heading: 'Welcome', subheading: '', backgroundImage: '' } },
};

interface DefaultField {
  id: string;
  type: string;
  label: string;
  variable: string;
  required: boolean;
  placeholder: string;
  defaultValue: string;
  options: string[];
  validation: Record<string, any>;
  props: Record<string, any>;
  [key: string]: any;
}

/**
 * Generate a default field object for a given type.
 */
export function createDefaultField(type: string, overrides: Partial<DefaultField> = {}): DefaultField {
  const fieldDef = FIELD_TYPES[type];
  return {
    id: crypto.randomUUID(),
    type,
    label: fieldDef?.label || 'Field',
    variable: '',
    required: false,
    placeholder: (fieldDef?.defaultProps?.placeholder as string) || '',
    defaultValue: '',
    options: (fieldDef?.defaultProps?.options as string[]) || [],
    validation: {},
    props: { ...(fieldDef?.defaultProps || {}) },
    ...overrides,
  };
}

interface ExtractedVariable {
  id: string;
  variable: string;
  label: string;
  type: string;
}

/**
 * Extract all variables from a form schema.
 */
export function extractVariables(schema: { pages?: Array<{ sections?: Array<{ fields?: Array<{ id: string; variable: string; label: string; type: string }> }> }> }): ExtractedVariable[] {
  if (!schema?.pages) return [];
  const vars: ExtractedVariable[] = [];
  for (const page of schema.pages) {
    for (const section of page.sections || []) {
      for (const field of section.fields || []) {
        if (field.variable) {
          vars.push({ id: field.id, variable: field.variable, label: field.label, type: field.type });
        }
      }
    }
  }
  return vars;
}

interface EmptySchemaSection {
  id: string;
  title: string;
  fields: any[];
}

interface EmptySchemaPage {
  id: string;
  title: string;
  sections: EmptySchemaSection[];
}

interface EmptySchema {
  name: string;
  description: string;
  pages: EmptySchemaPage[];
  actions: Array<{ id: string; label: string; type: string; variant: string }>;
}

/**
 * Create a default empty form schema.
 */
export function createEmptySchema(name: string = 'Untitled Form'): EmptySchema {
  return {
    name,
    description: '',
    pages: [
      {
        id: crypto.randomUUID(),
        title: 'Page 1',
        sections: [
          {
            id: crypto.randomUUID(),
            title: 'Section 1',
            fields: [],
          },
        ],
      },
    ],
    actions: [
      { id: crypto.randomUUID(), label: 'Submit', type: 'submit', variant: 'primary' },
    ],
  };
}
