'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import YearPageSectionHeader from '@/components/admin/YearPageSectionHeader';
import { LoadingInline } from '@/components/ui/Loading';
import { Modal } from '@/components/ui/Modal';
import { ParticipantIdentityFields } from '@/components/forms/ParticipantIdentityFields';
import { formatDate, formatDateOnly } from '@/lib/utils/dateUtils';
import {
  buildAvailabilitySlotChoices,
  formatAvailabilitySlotLabel,
  getAvailabilityDateSlotKeys,
  SPECIAL_AVAILABILITY_SLOT_CHOICES,
  normalizeAvailabilitySlots,
  toggleAvailabilitySelection,
  UNAVAILABLE_SLOT_KEY,
  ALL_AVAILABLE_SLOT_KEY,
} from '@/lib/utils/availability';
import { FormField, FormResponse, ParticipantSurveyResponse, SurveyForm } from '@/types/forms';
import type { AvailabilitySlotChoice } from '@/lib/utils/availability';

type AdminTab = 'content' | 'overview';

type FormRecord = SurveyForm & {
  responseCount: number;
  lastResponseAt?: string | Date;
};

type EventSummary = {
  distributionStartDate?: string | Date;
  distributionEndDate?: string | Date;
  distributionAvailabilitySlots?: string[];
  eventName?: string;
};

const DEFAULT_TITLE = '学外配布参加可否登録';
const DEFAULT_DESCRIPTION = '⚪︎月⚪︎日に実施する学外配布への参加可能日時を選択をお願いします。';

function toDateDisplay(value: Parameters<typeof formatDateOnly>[0]): string {
  return formatDateOnly(value);
}

function buildAvailabilityChoices(eventData: EventSummary | null, form: FormRecord | null): AvailabilitySlotChoice[] {
  if (eventData?.distributionStartDate && eventData?.distributionEndDate) {
    const allChoices = buildAvailabilitySlotChoices(eventData.distributionStartDate, eventData.distributionEndDate);
    const selectedKeys = Array.isArray(eventData.distributionAvailabilitySlots) && eventData.distributionAvailabilitySlots.length > 0
      ? eventData.distributionAvailabilitySlots
      : allChoices.map((choice) => choice.key);
    return [
      ...allChoices.filter((choice) => selectedKeys.includes(choice.key)),
      ...SPECIAL_AVAILABILITY_SLOT_CHOICES,
    ];
  }

  const existingOptions = form?.fields.find((field) => field.fieldId === 'availability')?.options || [];
  return existingOptions.map((option) => ({
    key: option as AvailabilitySlotChoice['key'],
    label: formatAvailabilitySlotLabel(option),
    period: 'special' as const,
  }));
}

function buildFixedFields(availabilityOptions: string[]): FormField[] {
  return [
    {
      fieldId: 'availability',
      type: 'checkbox',
      label: '参加可能日時',
      placeholder: '参加可能な日時を選択してください',
      required: true,
      options: availabilityOptions,
      order: 0,
    },
    {
      fieldId: 'remarks',
      type: 'textarea',
      label: '備考',
      placeholder: 'その他連絡事項があればご記入ください',
      required: false,
      order: 1,
    },
  ];
}

function renderResponseValue(field: FormField, value: string | string[] | undefined): string {
  if (value === undefined || value === null) return '-';
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0) return '-';
  if (field.fieldId === 'availability') {
    return values.map((item) => formatAvailabilitySlotLabel(item)).join(' / ');
  }
  return values.join(' / ');
}

function isAvailabilityField(field: FormField) {
  return field.fieldId === 'availability';
}

export default function FormDashboardPage({ params }: { params: Promise<{ year: string }> }) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ year: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [eventData, setEventData] = useState<EventSummary | null>(null);
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [responses, setResponses] = useState<(FormResponse | ParticipantSurveyResponse)[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('content');
  const [draftTitle, setDraftTitle] = useState(DEFAULT_TITLE);
  const [draftDescription, setDraftDescription] = useState(DEFAULT_DESCRIPTION);
  const [draftIsActive, setDraftIsActive] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [editingResponse, setEditingResponse] = useState<(FormResponse | ParticipantSurveyResponse) | null>(null);
  const [editFormData, setEditFormData] = useState<{ [key: string]: string | string[] }>({});
  const [editSaving, setEditSaving] = useState(false);
  const hasLoadedFormRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responsesCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      if (!nextUser) {
        router.push('/admin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const currentForm = forms[0] ?? null;
  const allAvailabilityChoices = useMemo(() => buildAvailabilityChoices(eventData, currentForm), [eventData, currentForm]);
  const latestResponse = useMemo(
    () => [...responses].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0] || null,
    [responses]
  );
  const sortedResponses = useMemo(
    () => [...responses].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    [responses]
  );
  useEffect(() => {
    if (currentForm) {
      setDraftTitle(currentForm.title);
      setDraftDescription(currentForm.description || '');
      setDraftIsActive(currentForm.isActive);
      hasLoadedFormRef.current = true;
    } else {
      setDraftTitle(DEFAULT_TITLE);
      setDraftDescription(DEFAULT_DESCRIPTION);
      setDraftIsActive(true);
      hasLoadedFormRef.current = true;
    }
  }, [currentForm]);

  const loadDashboard = async () => {
    if (!resolvedParams || !user) return;

    try {
      setLoading(true);
      setError('');

      const token = await user.getIdToken();
      const eventId = `kohdai${resolvedParams.year}`;

      const [formsRes, eventRes] = await Promise.all([
        fetch(`/api/forms?eventId=${eventId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`/api/admin/events?year=${resolvedParams.year}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const formsData = await formsRes.json().catch(() => null);
      const eventJson = await eventRes.json().catch(() => null);

      if (!formsRes.ok) {
        setForms([]);
        setResponses([]);
        setError(formsData?.error || 'フォーム情報の取得に失敗しました');
        return;
      }

      if (eventRes.ok && eventJson?.data) {
        setEventData(eventJson.data);
      } else {
        setEventData(null);
      }

      const loadedForms = (formsData?.forms || []) as FormRecord[];
      setForms(loadedForms);

      const nextForm = loadedForms[0] ?? null;
      if (!nextForm) {
        setResponses([]);
        return;
      }

      const responsesRes = await fetch(`/api/forms/${nextForm.formId}/responses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const responsesData = await responsesRes.json().catch(() => null);

      if (responsesRes.ok) {
        setResponses((responsesData?.responses || []) as (FormResponse | ParticipantSurveyResponse)[]);
      } else {
        setResponses([]);
        setError(responsesData?.error || '回答情報の取得に失敗しました');
      }
    } catch (err) {
      console.error(err);
      setError('フォーム管理画面の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resolvedParams || !user || authLoading) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams, user, authLoading]);

  const createForm = async () => {
    if (!resolvedParams || !user) return;

    try {
      setSaving(true);
      setError('');

      if (!draftTitle.trim()) {
        setError('フォームタイトルを入力してください');
        return;
      }

      if (!eventData?.distributionStartDate || !eventData?.distributionEndDate) {
        setError('配布期間が取得できないため、フォームを作成できません');
        return;
      }

      const availabilityOptions = allAvailabilityChoices.map((choice) => choice.key);
      if (availabilityOptions.length === 0) {
        setError('参加可能日時を一つ以上選択してください');
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: draftTitle.trim(),
          description: draftDescription.trim(),
          fields: buildFixedFields(availabilityOptions),
          eventId: `kohdai${resolvedParams.year}`,
          year: Number(resolvedParams.year),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || 'フォームの作成に失敗しました');
        return;
      }

      setForms([data.form as FormRecord]);
      setResponses([]);
      setActiveTab('content');
    } catch (err) {
      console.error(err);
      setError('フォームの作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const persistFormSettings = async (silent = false) => {
    if (!resolvedParams || !user || !currentForm) return;

    try {
      setSaving(true);
      if (!silent) {
        setError('');
      }
      setSaveStatus('saving');

      if (!draftTitle.trim()) {
        setError('フォームタイトルを入力してください');
        return;
      }

      const availabilityOptions = allAvailabilityChoices.map((choice) => choice.key);
      if (availabilityOptions.length === 0) {
        setError('参加可能日時を一つ以上選択してください');
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch(`/api/forms/${currentForm.formId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: draftTitle.trim(),
          description: draftDescription.trim(),
          isActive: draftIsActive,
          fields: buildFixedFields(availabilityOptions),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || 'フォームの更新に失敗しました');
        setSaveStatus('error');
        return;
      }

      const nextForm = data.form as FormRecord;
      setForms([nextForm]);
      setSaveStatus('saved');
    } catch (err) {
      console.error(err);
      setError('フォームの更新に失敗しました');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!currentForm || !hasLoadedFormRef.current) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void persistFormSettings(true);
    }, 700);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTitle, draftDescription, draftIsActive, currentForm?.formId]);

  const openEditModal = (response: FormResponse | ParticipantSurveyResponse) => {
    setEditingResponse(response);

    const participantResponse = response as ParticipantSurveyResponse;
    const formData: { [key: string]: string | string[] } = {
      participantName: participantResponse.participantData?.name || '',
      participantGrade: participantResponse.participantData?.grade?.toString() || '',
      participantSection: participantResponse.participantData?.section || '',
    };

    response.answers.forEach((answer) => {
      formData[answer.fieldId] = answer.value;
    });

    if (participantResponse.participantData?.availableSlots) {
      formData.availability = participantResponse.participantData.availableSlots;
    }

    setEditFormData(formData);
  };

  const closeEditModal = () => {
    setEditingResponse(null);
    setEditFormData({});
    setEditSaving(false);
  };

  const updateResponse = async () => {
    if (!editingResponse || !currentForm || !resolvedParams || !user) return;

    try {
      setEditSaving(true);
      setError('');

      const token = await user.getIdToken();
      const answers = currentForm.fields.map((field) => ({
        fieldId: field.fieldId,
        value: editFormData[field.fieldId] || (field.type === 'checkbox' ? [] : ''),
      }));

      const availableSlots = normalizeAvailabilitySlots(editFormData.availability);

      const res = await fetch(`/api/forms/${currentForm.formId}/responses/${editingResponse.responseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers,
          participantData: {
            name: String(editFormData.participantName || ''),
            section: String(editFormData.participantSection || ''),
            grade: parseInt(String(editFormData.participantGrade || '0'), 10),
            availableSlots,
          },
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || '回答の更新に失敗しました');
        return;
      }

      await loadDashboard();
      closeEditModal();
    } catch (err) {
      console.error(err);
      setError('回答の更新に失敗しました');
    } finally {
      setEditSaving(false);
    }
  };

  const deleteForm = async () => {
    if (!resolvedParams || !user || !currentForm) return;

    if (!confirm('このフォームを削除しますか？回答データも含めて削除されます。')) {
      return;
    }

    try {
      setDeleting(true);
      setError('');

      const token = await user.getIdToken();
      const res = await fetch(`/api/forms/${currentForm.formId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || 'フォームの削除に失敗しました');
        return;
      }

      setForms([]);
      setResponses([]);
      setActiveTab('content');
      setDraftTitle(DEFAULT_TITLE);
      setDraftDescription(DEFAULT_DESCRIPTION);
      setDraftIsActive(true);
    } catch (err) {
      console.error(err);
      setError('フォームの削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const renderFieldPreview = (field: FormField) => {
    if (field.fieldId === 'availability') {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {allAvailabilityChoices.length > 0 ? (
            allAvailabilityChoices.map((choice) => (
              <label
                key={choice.key}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <input type="checkbox" disabled className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                <span className="text-sm text-gray-700">{choice.label}</span>
              </label>
            ))
          ) : (
            <p className="text-sm text-red-600">配布期間から選択肢を生成できませんでした</p>
          )}
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          disabled
          rows={4}
          placeholder={field.placeholder || ''}
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600"
        />
      );
    }

    if (field.type === 'select' || field.type === 'radio') {
      return (
        <div className="space-y-2">
          {(field.options || []).map((option) => (
            <div key={option} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {option}
            </div>
          ))}
        </div>
      );
    }

    return (
      <input
        disabled
        type={field.type === 'number' ? 'number' : 'text'}
        placeholder={field.placeholder || ''}
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600"
      />
    );
  };

  const renderEditableField = (field: FormField) => {
    const fieldValue = editFormData[field.fieldId];
    const optionLabel = (option: string) => (isAvailabilityField(field) ? formatAvailabilitySlotLabel(option) : option);

    if (isAvailabilityField(field)) {
      const selectedValues = Array.isArray(fieldValue) ? fieldValue : [];
      const allDateSlotKeys = getAvailabilityDateSlotKeys(
        (field.options || []).map((option) => ({
          key: option,
          label: option,
        }))
      );
      const specialOptions = (field.options || []).filter(
        (option) => option === UNAVAILABLE_SLOT_KEY || option === ALL_AVAILABLE_SLOT_KEY
      );
      const dateOptions = (field.options || []).filter(
        (option) => option !== UNAVAILABLE_SLOT_KEY && option !== ALL_AVAILABLE_SLOT_KEY
      );

      const renderOptionCard = (option: string, index: number, tone: 'date' | 'special' = 'date') => {
        const selected = selectedValues.includes(option);
        const isSpecial = tone === 'special';
        return (
          <label
            key={`${option}-${index}`}
            className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all duration-150 ${
              selected
                ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-200'
                : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              value={option}
              checked={selected}
              onChange={() => {
                const currentValues = Array.isArray(editFormData.availability) ? editFormData.availability : [];
                const nextValues = toggleAvailabilitySelection(currentValues, option, allDateSlotKeys);
                setEditFormData((current) => ({
                  ...current,
                  availability: nextValues,
                }));
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
              <span className="block text-sm font-medium text-gray-900">
                {optionLabel(option)}
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                {isSpecial
                  ? option === ALL_AVAILABLE_SLOT_KEY
                    ? '配布期間内の全日時に対応可能です'
                    : 'この日時には参加できません'
                  : '複数選択できます'}
              </span>
            </span>
          </label>
        );
      };

      return (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600">参加可能な日時を選択してください。</p>
            <p className="text-xs text-gray-500">複数選択可</p>
          </div>

          {specialOptions.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {specialOptions.map((option, index) => renderOptionCard(option, index, 'special'))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dateOptions.map((option, index) => renderOptionCard(option, index))}
          </div>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          value={typeof fieldValue === 'string' ? fieldValue : ''}
          onChange={(e) => setEditFormData((current) => ({ ...current, [field.fieldId]: e.target.value }))}
          rows={4}
          className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500"
        />
      );
    }

    if (field.type === 'select' || field.type === 'radio') {
      return (
        <select
          value={typeof fieldValue === 'string' ? fieldValue : ''}
          onChange={(e) => setEditFormData((current) => ({ ...current, [field.fieldId]: e.target.value }))}
          className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500"
        >
          <option value="">選択してください</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={typeof fieldValue === 'string' ? fieldValue : ''}
        onChange={(e) => setEditFormData((current) => ({ ...current, [field.fieldId]: e.target.value }))}
        className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500"
      />
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingInline size="lg" />
      </div>
    );
  }

  if (!user || !resolvedParams) {
    return null;
  }

  const headerActions = currentForm ? (
    <>
      <Link
        href={`/admin/event/${resolvedParams.year}`}
        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        イベント管理に戻る
      </Link>
      <a
        href={`/form/${currentForm.formId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        公開フォームを開く
      </a>
      <label className="inline-flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={draftIsActive}
          onChange={(e) => setDraftIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        フォームを公開する
      </label>
    </>
  ) : (
    <Link
      href={`/admin/event/${resolvedParams.year}`}
      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      イベント管理に戻る
    </Link>
  );

  if (!currentForm) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <YearPageSectionHeader
            title={`フォーム管理 (${resolvedParams.year}年度)`}
            description="この年度にはフォームがまだありません。ここから作成します。"
            actions={headerActions}
          />

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">基本設定</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      フォームタイトル *
                    </label>
                    <input
                      id="title"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-0 focus:border-indigo-500"
                      placeholder="例: 工大祭準備に関するアンケート"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      説明文
                    </label>
                    <textarea
                      id="description"
                      rows={4}
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-0 focus:border-indigo-500"
                      placeholder="フォームの目的や注意事項を記載してください"
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">配布日時の設定</h3>
                    </div>
                    <Link
                      href={`/admin/event/${resolvedParams.year}/distribution`}
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      設定を開く
                    </Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {allAvailabilityChoices.length > 0 ? (
                      allAvailabilityChoices.map((choice) => (
                        <span key={choice.key} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {choice.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-red-600">配布日時が未設定です</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <Link
                    href={`/admin/event/${resolvedParams.year}`}
                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    キャンセル
                  </Link>
                  <button
                    type="button"
                    onClick={createForm}
                    disabled={saving}
                    className="inline-flex items-center rounded-lg border border-transparent bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? '作成中...' : 'フォームを作成'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-gray-200 bg-gray-100 p-4">
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">プレビュー</p>
                <h3 className="mt-2 text-2xl font-semibold text-gray-900">{draftTitle || DEFAULT_TITLE}</h3>
                {draftDescription && <p className="mt-3 text-sm leading-6 text-gray-600">{draftDescription}</p>}
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">参加可能日時 *</p>
                      <p className="text-xs text-gray-500">複数選択可</p>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">checkbox</span>
                  </div>
                  {renderFieldPreview({
                    fieldId: 'availability',
                    type: 'checkbox',
                    label: '参加可能日時',
                    required: true,
                    options: allAvailabilityChoices.map((choice) => choice.key),
                    order: 0,
                  })}
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">備考</p>
                      <p className="text-xs text-gray-500">自由記述</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">textarea</span>
                  </div>
                  <textarea
                    disabled
                    rows={4}
                    placeholder="その他連絡事項があればご記入ください"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <YearPageSectionHeader
          title={`フォーム管理 (${resolvedParams.year}年度)`}
          actions={headerActions}
        />

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-gray-900">{draftTitle || currentForm.title}</h1>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${draftIsActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                      }`}
                  >
                    {draftIsActive ? '公開中' : '非公開'}
                  </span>
                </div>
                {draftDescription && <p className="max-w-3xl text-sm leading-6 text-gray-600">{draftDescription}</p>}
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>回答数: {responses.length}</span>
                  <span>最終回答: {latestResponse ? formatDate(latestResponse.submittedAt) : '-'}</span>
                  <span>配布期間: {eventData?.distributionStartDate && eventData?.distributionEndDate ? `${toDateDisplay(eventData.distributionStartDate)} 〜 ${toDateDisplay(eventData.distributionEndDate)}` : '未設定'}</span>
                  <span>
                    自動保存:{' '}
                    {saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? '保存済み' : '保存エラー'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'content'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  フォーム内容
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('overview');
                    responsesCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'overview'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  回答・各種設定
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'content' && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">フォーム内容</h3>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="content-title" className="block text-sm font-medium text-gray-700">
                        フォームタイトル *
                      </label>
                      <input
                        id="content-title"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-0 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="content-description" className="block text-sm font-medium text-gray-700">
                        説明文
                      </label>
                      <textarea
                        id="content-description"
                        rows={4}
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-0 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {currentForm.fields.map((field) => (
                    <div key={field.fieldId} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{field.label}</h3>
                          <p className="text-xs text-gray-500">
                            {field.type}
                            {field.required ? ' ・ 必須' : ' ・ 任意'}
                          </p>
                        </div>
                        {field.fieldId === 'availability' && (
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">複数選択</span>
                        )}
                      </div>
                      {renderFieldPreview(field)}
                    </div>
                  ))}
                </div>

              </div>
            )}

            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">選択肢設定</h3>
                    </div>
                    <Link
                      href={`/admin/event/${resolvedParams.year}/distribution`}
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      イベント設定へ
                    </Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {allAvailabilityChoices.length > 0 ? (
                      allAvailabilityChoices.map((choice) => (
                        <span key={choice.key} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {choice.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-red-600">配布日時が未設定です</span>
                    )}
                  </div>
                </div>

                <div ref={responsesCardRef} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">回答</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">回答数</p>
                        <p className="mt-1 text-2xl font-semibold text-gray-900">{responses.length}</p>
                      </div>
                      <div className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">最新回答</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {latestResponse ? formatDate(latestResponse.submittedAt) : 'まだ回答がありません'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {responses.length === 0 ? (
                    <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
                      <p className="text-lg font-medium text-gray-900">回答がありません</p>
                      <p className="mt-2 text-sm text-gray-500">フォームを公開すると、このカード内に回答が表示されます。</p>
                    </div>
                  ) : (
                    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">回答日時</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">参加者情報</th>
                              {currentForm.fields.map((field) => (
                                <th key={field.fieldId} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                                  {field.label}
                                </th>
                              ))}
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {sortedResponses.map((response) => {
                              const participantResponse = response as ParticipantSurveyResponse;

                              return (
                                <tr key={response.responseId} className="align-top">
                                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
                                    {formatDate(response.submittedAt)}
                                  </td>
                                  <td className="px-4 py-4 text-sm text-gray-900">
                                    <div className="font-medium">
                                      {participantResponse.participantData?.name || '名前未入力'}
                                    </div>
                                    <div className="mt-1 text-gray-500">
                                      {participantResponse.participantData?.grade ? `${participantResponse.participantData.grade}年 ` : ''}
                                      {participantResponse.participantData?.section || ''}
                                    </div>
                                  </td>
                                  {currentForm.fields.map((field) => {
                                    const answer = response.answers.find((item) => item.fieldId === field.fieldId);
                                    return (
                                      <td key={field.fieldId} className="px-4 py-4 text-sm text-gray-900">
                                        <div className="max-w-[18rem] whitespace-pre-wrap break-words">
                                          {renderResponseValue(field, answer?.value as string | string[] | undefined)}
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(response)}
                                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      編集
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={deleteForm}
                    disabled={deleting}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting ? '削除中...' : 'フォームを削除'}
                  </button>
                </div>
                <p className="text-sm text-gray-500">
                  保存状態: {saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? '保存済み' : '保存エラー'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingResponse && currentForm && (
        <Modal
          open
          onClose={closeEditModal}
          centered={false}
          panelClassName="max-w-4xl"
          contentClassName="px-6 py-6"
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">回答を編集</h2>
            </div>
            <button
              type="button"
              onClick={closeEditModal}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-6">
            <div className="space-y-6">
              <ParticipantIdentityFields
                name={String(editFormData.participantName || '')}
                grade={String(editFormData.participantGrade || '')}
                section={String(editFormData.participantSection || '')}
                onNameChange={(value) => setEditFormData((current) => ({ ...current, participantName: value }))}
                onGradeChange={(value) => setEditFormData((current) => ({ ...current, participantGrade: value }))}
                onSectionChange={(value) => setEditFormData((current) => ({ ...current, participantSection: value }))}
              />

              {currentForm.fields.map((field) => (
                <div key={field.fieldId} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{field.label}</h3>
                      <p className="text-xs text-gray-500">
                        {field.type}
                        {field.required ? ' ・ 必須' : ' ・ 任意'}
                      </p>
                    </div>
                  </div>
                  {renderEditableField(field)}
                </div>
              ))}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={updateResponse}
                  disabled={editSaving}
                  className="rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editSaving ? '保存中...' : '変更を保存'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
