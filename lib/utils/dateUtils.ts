/**
 * Firestore Timestamp型やDate、文字列、数値を統一的にフォーマットするユーティリティ
 */

// Firestore Timestampライクなオブジェクトの型定義
interface FirestoreTimestamp {
  toDate: () => Date;
}

// サポートする日付型の定義
type DateValue = Date | string | number | FirestoreTimestamp | null | undefined;

/**
 * 様々な形式の日付値を日本語形式の文字列にフォーマット
 * @param dateValue - フォーマットする日付値
 * @param options - フォーマットオプション
 * @returns フォーマットされた日付文字列
 */
export function formatDate(
  dateValue: DateValue,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }
): string {
  if (!dateValue) return '-';

  try {
    let date: Date;

    // Firestore Timestampオブジェクトの場合
    if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
      date = (dateValue as FirestoreTimestamp).toDate();
    }
    // 文字列の場合
    else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    }
    // 数値（Unix timestamp）の場合
    else if (typeof dateValue === 'number') {
      date = new Date(dateValue);
    }
    // Dateオブジェクトの場合
    else if (dateValue instanceof Date) {
      date = dateValue;
    }
    // その他の場合はエラー
    else {
      return 'Invalid Date';
    }

    // 日付の妥当性チェック
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleString('ja-JP', options);
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
}

/**
 * 日付のみをフォーマット（時刻なし）
 */
export function formatDateOnly(dateValue: DateValue): string {
  return formatDate(dateValue, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * 時刻のみをフォーマット（日付なし）
 */
export function formatTimeOnly(dateValue: DateValue): string {
  return formatDate(dateValue, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 相対時間を表示（例: "2時間前"）
 */
export function formatRelativeTime(dateValue: DateValue): string {
  if (!dateValue) return '-';

  try {
    const date = new Date(dateValue as string | number | Date);
    if (isNaN(date.getTime())) return 'Invalid Date';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'たった今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    
    return formatDateOnly(dateValue);
  } catch (error) {
    console.error('Relative time formatting error:', error);
    return 'Invalid Date';
  }
}