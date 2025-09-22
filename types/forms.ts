/**
 * アンケートフォーム関連の型定義
 */

export interface SurveyForm {
  formId: string;
  title: string;
  description?: string;
  isActive: boolean;
  eventId: string;
  year: number;
  fields: FormField[];
  createdBy: string;  // 管理者ID
  createdAt: Date;
  updatedAt: Date;
}

export interface FormField {
  fieldId: string;
  type: 'text' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'number';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];  // select, radio, checkbox用
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;  // number用
    max?: number;  // number用
    pattern?: string;  // 正規表現
  };
  order: number;
}

export interface FormResponse {
  responseId: string;
  formId: string;
  answers: FormAnswer[];
  submittedAt: Date;
  submitterInfo?: {
    name?: string;
    email?: string;
    ipAddress?: string;
  };
}

export interface FormAnswer {
  fieldId: string;
  value: string | string[];  // checkbox は配列
}

// フォーム作成・編集用のデータ
export interface FormCreateData {
  title: string;
  description?: string;
  fields: Omit<FormField, 'fieldId'>[];
}

export interface FormUpdateData {
  title?: string;
  description?: string;
  isActive?: boolean;
  fields?: FormField[];
}

// 参加者管理用（工大祭特化型）
export interface ParticipantSurveyResponse extends FormResponse {
  participantData: {
    name: string;
    section: string;  // 所属セクション
    grade: number;    // 学年
    availableTime: 'morning' | 'afternoon' | 'both';  // 参加可能時間帯
  };
}

// フォーム統計用
export interface FormStats {
  formId: string;
  totalResponses: number;
  responsesByField: {
    [fieldId: string]: {
      fieldLabel: string;
      responseCount: number;
      answers: {
        value: string;
        count: number;
        percentage: number;
      }[];
    };
  };
  participantStats?: {
    bySection: { [section: string]: number };
    byGrade: { [grade: string]: number };
    byAvailableTime: {
      morning: number;
      afternoon: number;
      both: number;
    };
  };
}

// APIレスポンス用
export interface FormListResponse {
  forms: (SurveyForm & {
    responseCount: number;
    lastResponseAt?: Date;
  })[];
}

export interface FormDetailResponse extends SurveyForm {
  responses: FormResponse[];
  stats: FormStats;
}