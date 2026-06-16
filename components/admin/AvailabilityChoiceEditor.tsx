'use client';

import { AvailabilityChoice, DEFAULT_AVAILABILITY_CHOICES } from '@/lib/utils/availability';

interface Props {
  choices: AvailabilityChoice[];
  onChange: (choices: AvailabilityChoice[]) => void;
}

export default function AvailabilityChoiceEditor({ choices, onChange }: Props) {
  const updateChoice = (key: AvailabilityChoice['key'], patch: Partial<AvailabilityChoice>) => {
    onChange(
      choices.map((choice) => (choice.key === key ? { ...choice, ...patch } : choice))
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">参加可能時間帯の選択肢</h3>
      </div>

      <div className="space-y-3">
        {DEFAULT_AVAILABILITY_CHOICES.map((defaultChoice) => {
          const choice = choices.find((item) => item.key === defaultChoice.key) || {
            ...defaultChoice,
            enabled: true,
          };

          return (
            <div
              key={choice.key}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-start gap-3">
                <label className="mt-1 inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={choice.enabled}
                    onChange={(e) => updateChoice(choice.key, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-gray-700">
                      {choice.label}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
