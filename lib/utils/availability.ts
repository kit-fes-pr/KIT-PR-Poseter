export type AvailableTime = 'morning' | 'afternoon' | 'both' | 'pr' | 'other';

// 安定キーへの正規化関数
export function normalizeAvailableTime(
  input: unknown,
  options?: string[] | null,
  defaultValue: AvailableTime = 'other'
): AvailableTime {
  // 1) すでに安定キーの場合
  if (
    input === 'morning' ||
    input === 'afternoon' ||
    input === 'both' ||
    input === 'pr' ||
    input === 'other'
  ) {
    return input;
  }

  // 2) options と組み合わせてインデックスや厳密一致で判定
  if (options && options.length > 0) {
    // 数値インデックス指定（0:morning, 1:afternoon, 2:pr, それ以外:other）
    if (typeof input === 'number' && Number.isInteger(input)) {
      return input === 0
        ? 'morning'
        : input === 1
        ? 'afternoon'
        : input === 2
        ? 'pr'
        : 'other';
    }
    // 文字列が options のいずれかと一致する場合、そのインデックスで判定
    if (typeof input === 'string') {
      const idx = options.findIndex((o) => o === input);
      if (idx >= 0)
        return idx === 0
          ? 'morning'
          : idx === 1
          ? 'afternoon'
          : idx === 2
          ? 'pr'
          : 'other';
    }
  }

  // 3) 最後のフォールバック（ローカライズされた文言などの部分一致）
  if (typeof input === 'string') {
    const v = input.toLowerCase();
    // 英語/日本語の代表的な表記をカバー
    if (v.includes('morning') || v.includes('午前')) return 'morning';
    if (v.includes('afternoon') || v.includes('午後')) return 'afternoon';
    if (v === 'pr' || v.includes('ｐｒ') || v.includes('pr専用') || v.includes('広報')) return 'pr';
    if (v.includes('その他') || v.includes('そのほか') || v.includes('other')) return 'other';
  }

  return defaultValue;
}
