import type { FormSchema, FormSettings, FieldValidation } from '../types/models';

/**
 * Form Engine — Handles conditional logic, calculated fields, and advanced validation.
 */

/**
 * Evaluate conditional visibility rules for form fields.
 * Returns the set of field IDs that should be visible.
 */
export function evaluateVisibility(schema: FormSchema, formData: Record<string, any>): Set<string> {
  const visibleFields = new Set<string>();

  for (const page of schema.pages || []) {
    for (const section of page.sections || []) {
      for (const field of section.fields || []) {
        const visibility = field.props?.visibility;
        if (!visibility || visibility.type === 'always') {
          visibleFields.add(field.id);
          continue;
        }

        const results = (visibility.conditions || []).map((cond: any) => {
          const fieldValue = getFieldValue(formData, cond.fieldId, schema);
          return evaluateCondition(fieldValue, cond.operator, cond.value);
        });

        const visible = visibility.logic === 'or'
          ? results.some(Boolean)
          : results.every(Boolean);

        if (visible) visibleFields.add(field.id);
      }
    }
  }

  return visibleFields;
}

function getFieldValue(formData: Record<string, any>, fieldId: string, schema: FormSchema): any {
  for (const page of schema.pages || []) {
    for (const section of page.sections || []) {
      for (const field of section.fields || []) {
        if (field.id === fieldId) {
          return formData[field.variable];
        }
      }
    }
  }
  return undefined;
}

function evaluateCondition(fieldValue: any, operator: string, compareValue: any): boolean {
  switch (operator) {
    case 'eq': return fieldValue == compareValue;
    case 'neq': return fieldValue != compareValue;
    case 'gt': return Number(fieldValue) > Number(compareValue);
    case 'gte': return Number(fieldValue) >= Number(compareValue);
    case 'lt': return Number(fieldValue) < Number(compareValue);
    case 'lte': return Number(fieldValue) <= Number(compareValue);
    case 'contains': return String(fieldValue || '').includes(compareValue);
    case 'startsWith': return String(fieldValue || '').startsWith(compareValue);
    case 'isEmpty': return !fieldValue || fieldValue === '' || fieldValue === null;
    case 'isNotEmpty': return fieldValue && fieldValue !== '';
    default: return true;
  }
}

/**
 * Calculate computed fields based on form data.
 */
export function calculateFields(schema: FormSchema, formData: Record<string, any>, settings?: FormSettings): Record<string, any> {
  const calculated: Record<string, any> = {};
  const calcs = settings?.calculatedFields || [];

  for (const calc of calcs) {
    try {
      const value = evaluateFormula(calc.formula, formData, schema);
      calculated[calc.variable] = formatValue(value, calc.format);
    } catch {
      calculated[calc.variable] = null;
    }
  }

  return calculated;
}

function evaluateFormula(formula: string, formData: Record<string, any>, schema: FormSchema): number {
  let expr = formula.replace(/FIELD\((\w+)\)/g, (_, varName: string) => {
    const val = formData[varName];
    return isNaN(val) ? '0' : String(Number(val));
  });

  expr = expr.replace(/SUM\((\w+)\)/g, (_, varName: string) => {
    const items = formData[varName];
    if (!Array.isArray(items)) return '0';
    return String(items.reduce((sum: number, item: any) => sum + (Number(item) || 0), 0));
  });

  expr = expr.replace(/COUNT\((\w+)\)/g, (_, varName: string) => {
    const items = formData[varName];
    return String(Array.isArray(items) ? items.length : (items ? 1 : 0));
  });

  expr = expr.replace(/AVG\((\w+)\)/g, (_, varName: string) => {
    const items = formData[varName];
    if (!Array.isArray(items) || items.length === 0) return '0';
    return String(items.reduce((sum: number, item: any) => sum + (Number(item) || 0), 0) / items.length);
  });

  expr = expr.replace(/MIN\((\w+)\)/g, (_, varName: string) => {
    const items = formData[varName];
    if (!Array.isArray(items) || items.length === 0) return '0';
    return String(Math.min(...items.map(Number)));
  });

  expr = expr.replace(/MAX\((\w+)\)/g, (_, varName: string) => {
    const items = formData[varName];
    if (!Array.isArray(items) || items.length === 0) return '0';
    return String(Math.max(...items.map(Number)));
  });

  // Safe evaluation — only allow numbers and basic operators
  if (/^[\d\s+\-*/().]+$/.test(expr)) {
    // eslint-disable-next-line no-new-func
    try { return Function('"use strict"; return (' + expr + ')')() as number; } catch { return 0; }
  }
  return 0;
}

function formatValue(value: number | null, format: string): string | number | null {
  if (value === null || value === undefined) return null;
  switch (format) {
    case 'currency': return Number(value).toFixed(2);
    case 'percent': return Number(value).toFixed(1);
    case 'number': return Number(value);
    default: return String(value);
  }
}

/**
 * Advanced validation — cross-field, regex, custom rules.
 */
export function validateSubmission(schema: FormSchema, formData: Record<string, any>, settings?: FormSettings): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const page of schema.pages || []) {
    for (const section of page.sections || []) {
      for (const field of section.fields || []) {
        const value = formData[field.variable];
        const v: FieldValidation = field.validation || {};
        const fieldErrors: string[] = [];

        // Required
        if (v.required && (value === undefined || value === null || value === '')) {
          fieldErrors.push(v.requiredMessage || `${field.label} is required`);
        }

        // String length
        if (typeof value === 'string') {
          if (v.minLength && value.length < v.minLength) {
            fieldErrors.push(`Minimum ${v.minLength} characters`);
          }
          if (v.maxLength && value.length > v.maxLength) {
            fieldErrors.push(`Maximum ${v.maxLength} characters`);
          }
        }

        // Numeric range
        if (value !== undefined && value !== null && value !== '') {
          if (v.min !== undefined && Number(value) < Number(v.min)) {
            fieldErrors.push(`Minimum value is ${v.min}`);
          }
          if (v.max !== undefined && Number(value) > Number(v.max)) {
            fieldErrors.push(`Maximum value is ${v.max}`);
          }
        }

        // Regex pattern
        if (v.pattern && value) {
          try {
            const regex = new RegExp(v.pattern);
            if (!regex.test(String(value))) {
              fieldErrors.push(v.patternMessage || 'Invalid format');
            }
          } catch { /* invalid regex, skip */ }
        }

        // Cross-field validation
        if (v.customRules) {
          for (const rule of v.customRules) {
            if (rule.type === 'crossField') {
              const otherValue = formData[rule.fieldVariable];
              if (!evaluateCondition(value, rule.operator, otherValue)) {
                fieldErrors.push(rule.message || 'Validation failed');
              }
            }
          }
        }

        if (fieldErrors.length > 0) {
          errors[field.variable] = fieldErrors;
        }
      }
    }
  }

  return errors;
}
