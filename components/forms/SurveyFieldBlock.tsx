'use client';

import { FormField } from '@/types/forms';
import type { RegisterOptions } from 'react-hook-form';
import {
  ALL_AVAILABLE_SLOT_KEY,
  formatAvailabilitySlotLabel,
  normalizeAvailabilitySlots,
  toggleAvailabilitySelection,
  UNAVAILABLE_SLOT_KEY,
} from '@/lib/utils/availability/availability';

type SurveyFieldBlockProps = {
  field: FormField;
  value?: string | string[];
  errorMessage?: string;
  onValueChange?: (value: string | string[]) => void;
  availabilityCopy?: {
    allAvailable?: string;
    unavailable?: string;
  };
  interactive?: boolean;
};

export function buildSurveyFieldRules(field: FormField): RegisterOptions {
  return {
    required: field.required ? `${field.label}は必須です` : false,
    minLength: field.validation?.minLength
      ? {
          value: field.validation.minLength,
          message: `${field.label}は${field.validation.minLength}文字以上で入力してください`,
        }
      : undefined,
    maxLength: field.validation?.maxLength
      ? {
          value: field.validation.maxLength,
          message: `${field.label}は${field.validation.maxLength}文字以下で入力してください`,
        }
      : undefined,
    pattern: field.validation?.pattern
      ? {
          value: new RegExp(field.validation.pattern),
          message: `${field.label}の形式が正しくありません`,
        }
      : undefined,
    validate:
      field.type === 'checkbox'
        ? (rawValue: unknown) => {
            if (rawValue == null) {
              return field.required ? '一つ以上選択してください' : true;
            }

            if (!Array.isArray(rawValue)) {
              return '配列で送信してください';
            }

            if (!field.required) {
              return true;
            }

            return rawValue.length > 0 || '一つ以上選択してください';
          }
        : undefined,
  };
}

export function SurveyFieldBlock({
  field,
  value,
  errorMessage,
  onValueChange,
  availabilityCopy,
  interactive = true,
}: SurveyFieldBlockProps) {
  const fieldId = field.fieldId;
  const isRequired = field.required;
  const label = `${field.label}${isRequired ? ' *' : ''}`;
  const isAvailabilityField = fieldId === 'availability';
  const optionLabel = (option: string) =>
    isAvailabilityField ? formatAvailabilitySlotLabel(option) : option;
  const updateValue = (nextValue: string | string[]) => {
    if (!interactive) return;
    onValueChange?.(nextValue);
  };

  if (isAvailabilityField) {
    const selectedValues = normalizeAvailabilitySlots(value);
    const dateOptions = (field.options || []).filter(
      (option) => option !== UNAVAILABLE_SLOT_KEY && option !== ALL_AVAILABLE_SLOT_KEY,
    );
    const allDateSlotKeys = dateOptions;
    const showAllAvailableOption = dateOptions.length > 1;
    const displaySpecialOptions = (field.options || []).filter((option) => {
      if (option === UNAVAILABLE_SLOT_KEY) return true;
      if (option === ALL_AVAILABLE_SLOT_KEY) return showAllAvailableOption;
      return false;
    });

    const renderOptionCard = (option: string, index: number, tone: 'date' | 'special' = 'date') => {
      const selected = selectedValues.includes(option);
      const isSpecial = tone === 'special';

      return (
        <label
          key={`${option}-${index}`}
          className={`group flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all duration-150 ${
            selected
              ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-200'
              : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
          }`}
        >
          <input
            type="checkbox"
            value={option}
            checked={selected}
            disabled={!interactive}
            onChange={() => {
              if (!interactive) return;
              const currentValues = normalizeAvailabilitySlots(value);
              const nextValues = toggleAvailabilitySelection(
                currentValues,
                option,
                allDateSlotKeys,
              );
              updateValue(nextValues);
            }}
            className="sr-only"
          />
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
              selected
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-gray-300 bg-white text-transparent group-hover:border-indigo-400'
            }`}
            aria-hidden="true"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M16.704 5.29a1 1 0 0 1 0 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 1 1 1.414-1.414l2.543 2.543 6.543-6.543a1 1 0 0 1 1.414 0Z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-medium leading-5 text-gray-900">
              {optionLabel(option)}
            </span>
          </span>
        </label>
      );
    };

    return (
      <div>
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-gray-700">{label}</legend>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            {displaySpecialOptions.length > 0 && (
              <div className="mb-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
                {displaySpecialOptions.map((option, index) =>
                  renderOptionCard(option, index, 'special'),
                )}
              </div>
            )}

            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
              {dateOptions.map((option, index) => renderOptionCard(option, index))}
            </div>
          </div>
        </fieldset>
        {errorMessage && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <textarea
          id={fieldId}
          rows={4}
          placeholder={field.placeholder || ''}
          value={typeof value === 'string' ? value : ''}
          readOnly={!interactive}
          disabled={!interactive}
          onChange={(e) => updateValue(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
        {errorMessage && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div>
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <input
          id={fieldId}
          type="number"
          placeholder={field.placeholder || ''}
          value={typeof value === 'string' ? value : ''}
          readOnly={!interactive}
          disabled={!interactive}
          onChange={(e) => updateValue(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
        {errorMessage && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <select
          id={fieldId}
          value={typeof value === 'string' ? value : ''}
          disabled={!interactive}
          onChange={(e) => updateValue(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        >
          <option value="">選択してください</option>
          {field.options?.map((option, index) => (
            <option key={index} value={option}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
        {errorMessage && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
      </div>
    );
  }

  if (field.type === 'radio') {
    return (
      <div>
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-gray-700">{label}</legend>
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="radio"
                  value={option}
                  checked={value === option}
                  disabled={!interactive}
                  onChange={(e) => updateValue(e.target.value)}
                  className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">{optionLabel(option)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {errorMessage && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    const selectedValues = Array.isArray(value) ? value : [];

    return (
      <div>
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-gray-700">{label}</legend>
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const checked = selectedValues.includes(option);
              return (
                <label key={index} className="flex items-start">
                  <input
                    type="checkbox"
                    value={option}
                    checked={checked}
                    disabled={!interactive}
                    onChange={() => {
                      if (!interactive) return;
                      const nextValues = checked
                        ? selectedValues.filter((item) => item !== option)
                        : [...selectedValues, option];
                      updateValue(nextValues);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{optionLabel(option)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {errorMessage && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        placeholder={field.placeholder || ''}
        value={typeof value === 'string' ? value : ''}
        readOnly={!interactive}
        disabled={!interactive}
        onChange={(e) => updateValue(e.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
      />
      {errorMessage && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
}
