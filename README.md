# 工大祭ポスター配布管理システム

## プロジェクト概要

### システム概要
工大祭実行委員会のポスター配布業務をデジタル化するWebアプリケーション

### 解決する課題
- **紙ベース管理の非効率性**: これまで紙ベースでポスター配布済み店舗の管理を行っていた
- **情報共有の不備**: 午前・午後で配布済み箇所の情報共有ができていなかった
- **進捗把握の困難**: リアルタイムでの進捗状況把握が困難だった

### システムの目的
- ポスター配布状況のリアルタイム管理
- 工大祭実行委員会メンバー間での情報共有の効率化
- 配布作業の重複防止
- 年度を跨いだデータ管理と履歴参照
- 統計情報による来年度の改善案策立

### 対象ユーザー・配布範囲
- **ユーザー**: 工大祭実行委員会所属メンバー
- **配布対象**: 大学周辺の店舗（Google My Mapsで指定された範囲）
- **配布方法**: 各班に分かれて徒歩で回る
- **数年にわたる運用**: 年度別データ管理と履歴参照機能を備えている

## 機能要件

### 0. 年度管理機能
#### イベント管理
- 年度別の配布イベント作成・管理
- アクティブイベントの切り替え
- 過去イベントのアーカイブ管理

#### 履歴・統計機能
- 年度別配布実績の記録・参照
- チームパフォーマンスの分析・比較
- 年次トレンドグラフと統計レポート
- 最高パフォーマンスチームの記録

### 1. 店舗情報管理
#### 店舗登録方式
現地で以下の情報を手動入力する

#### 入力項目
- 店名（必須）
- 配布状況（配布済み/配布不可/保留/要再訪問）
- 配布枚数
- 配布不可理由（不在/断られた/閉店/その他）
- 住所（事前登録 or 手動入力）
- 配布区域管理番号（ログイン認証から自動設定）
- 備考（自由記述欄）

### 2. 認証・ユーザー管理
#### 班認証システム
- 各班用ログインコード（管理者事前発行）
- ログインコードに紐づく情報：
  - 班名
  - 担当配布区域（午前1、午後1など）
  - 参加時間帯（午前/午後）

#### 参加者管理
**CSVインポート機能**
- 項目: 名前、所属セクション、参加可能時間帯、学年

**アンケートフォーム**
- 項目: 名前、学年、所属セクション、参加可能時間帯

### 3. 配布区域管理
#### 区域設定
- 区域管理番号: 午前1、午後1、午前2、午後2...
- 各区域の担当店舗リスト管理

#### 班・区域割り当て
- 各班の担当区域設定
- 午前/午後の時間帯設定

### 4. 店舗リスト・検索機能
- **インテリジェント店舗表示**: 担当区域＋周辺区域の自動フィルタリング
- **五十音順ソート**: 店名→住所の順でソート（常時適用）
- **多段階フィルタ機能**: 
  - 配布区域（自動＋手動選択）
  - 配布状況（未配布/配布済み/配布不可/要再訪問）
  - 店名・住所検索（部分一致）
- **配布状況表示**: リアルタイム色分け表示
- **進捗確認**: 班別・全体の配布進捗・完了率

### 5. 管理者機能（Adminページ）
- 年度別配布区域設定
- 班の午前/午後スケジュール管理
- ログインコード発行・管理
- 参加者名簿管理
- 配布状況統計・レポート
- 周辺区域設定
- **年度別イベント管理**: 年ごとのデータ管理とアーカイブ
- **履歴管理**: 過去の配布実績と統計情報の参照
- **年次レポート**: チームパフォーマンスやトレンド分析

---

## 技術仕様

### アーキテクチャ概要
- **フレームワーク**: Next.js (React)
- **データベース**: Firebase Firestore  
- **認証**: Firebase Authentication
- **ホスティング**: Vercel
- **完全無料構成**: 外部API不要、すべて無料サービスで構築

### 技術スタック

#### フロントエンド
| 技術 | 用途 |
|-----|------|
| **Next.js** | Reactフレームワーク |
| **Tailwind CSS** | UIスタイリング |
| **React Hook Form** | フォーム管理 |
| **SWR** | データフェッチング |

#### バックエンド・データベース
| 技術 | 用途 |
|-----|------|
| **Firebase Firestore** | NoSQLデータベース |
| **Firebase Authentication** | 認証システム |
| **Next.js API Routes** | サーバーサイドAPI |

#### 開発・デプロイ
| 技術 | 用途 |
|-----|------|
| **TypeScript** | 型安全な開発 |
| **ESLint + Prettier** | コード品質管理 |
| **Vercel** | ホスティング・CI/CD |

### 認証・セキュリティ
- **Firebase Authentication** + カスタムクレーム
- **管理者認証**: st.kanazawa-it.ac.jp ドメイン限定
- **班認証**: ログインコード方式（例：AM1-2025）
- **セキュリティ要件**:
  - ログインコード有効期限: 学外配布日のみ
  - 同一ログインコードでの複数人同時ログイン許可
  - 認証必須（未認証時はアクセス不可）

### ページ構成・ルーティング
| パス | 画面名 | 認証要件 |
|-----|--------|---------|
| `/admin/event` | イベント管理 | 管理者認証 |
| `/admin/event/[year]` | 年度別イベント管理 | 管理者認証 |
| `/admin/event/[year]/team/[teamId]` | チーム詳細管理 | 管理者認証 |
| `/dashboard/all` | 全体ダッシュボード | 班認証 |
| `/` | ログインコード入力 | なし |
| `/form/{id}` | アンケート回答フォーム | なし |
| `/admin` | 管理者ログイン | なし |
| `/dashboard` | 配布管理画面 | 班認証 |
| `/admin/dashboard` | 管理者ダッシュボード | 管理者認証 |
| `/admin/form` | アンケートフォーム一覧 | 管理者認証 |
| `/admin/form/create` | アンケートフォーム作成 | 管理者認証 |
| `/admin/form/{id}` | アンケートフォーム編集 | 管理者認証 |
| `/admin/form/{id}/responses` | アンケート回答一覧 | 管理者認証 |

---

## データ構造設計

### Firestore コレクション設計

#### 主要エンティティ

##### 1. 配布イベント (`/distributionEvents/{eventId}`)
```typescript
interface DistributionEvent {
  eventId: string;           // "kohdai2025"
  eventName: string;         // "工大祭2025"
  distributionDate: Date;    // 学外配布日
  year: number;             // 2025
  isActive: boolean;        // 現在アクティブなイベントか
  createdAt: Date;
  updatedAt: Date;
}
```

##### 2. 班・チーム管理 (`/teams/{teamId}`)
```typescript
interface Team {
  teamId: string;           // "AM1-2025"
  teamCode: string;         // "AM1-2025"
  teamName: string;         // "午前1班"
  timeSlot: "morning" | "afternoon";
  assignedArea: string;     // "午前1"
  adjacentAreas: string[];  // ["午前2", "午後1"] 周辺区域
  eventId: string;          // "kohdai2025"
  isActive: boolean;
  validDate: Date;          // ログインコード有効日
  createdAt: Date;
}
```

##### 3. 店舗情報 (`/stores/{storeId}`)
```typescript
interface Store {
  storeId: string;
  storeName: string;
  storeNameKana: string;    // 店名カナ（ソート用）
  address: string;
  addressKana: string;      // 住所カナ（ソート用）
  areaCode: string;         // 配布区域管理番号
  distributionStatus: "pending" | "completed" | "failed" | "revisit";
  failureReason?: "absent" | "refused" | "closed" | "other";
  distributedCount: number; // 配布枚数
  distributedBy: string;    // 配布者（teamCode）
  createdByTeamCode?: string; // 登録者（手動登録時）
  distributedAt?: Date;
  notes?: string;           // 備考欄
  registrationMethod: "preset" | "manual";
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 補助エンティティ

##### 4. 配布区域 (`/areas/{areaId}`)
```typescript
interface Area {
  areaId: string;           // "morning-1"
  areaCode: string;         // "午前1"
  areaName: string;         // "午前1区域"
  timeSlot: "morning" | "afternoon";
  description?: string;     // 区域の説明
  eventId: string;
  createdAt: Date;
}
```

##### 5. 参加者管理 (`/members/{memberId}`)
```typescript
interface Member {
  memberId: string;
  name: string;
  section: string;          // 所属セクション
  grade: number;            // 学年
  availableTime: "morning" | "afternoon" | "both";
  teamId?: string;          // 割り当て班ID
  source: "csv" | "form";   // 登録元
  createdAt: Date;
}
```

---

## 認証システム

### 認証方式概要

#### 1. 班認証（ログインコード方式）
**一時的なメール/パスワード変換方式を採用**

**認証フロー:**
1. ユーザーがログインコード（例：AM1-2025）を入力
2. システムがログインコードを一時的なメール/パスワードに変換
   ```
   Email: {teamCode}@temp.kohdai-poster.local
   Password: システム生成のランダムパスワード
   ```
3. Firebase Authenticationで一時アカウント作成
4. Custom Claimsでチーム情報を設定
5. 24時間後に一時アカウントを自動削除

**メリット:**
- Firebase Authenticationの標準機能を活用
- 自動セッション管理
- 実装の簡素化

#### 2. 管理者認証（Firebase Authentication）
- **Firebase Auth**: createUserWithEmailAndPassword + sendEmailVerification を使用
- **ドメイン制限**: st.kanazawa-it.ac.jp ドメインのみ許可
- **認証フロー**:
  1. 管理者がメールアドレス・パスワードを入力
  2. Firebase Authentication でアカウント作成
  3. 自動でメール認証リンクを送信
  4. メール内のリンクから認証確認
  5. Custom Claims で管理者権限を付与
- **セキュリティ**: Firebase標準のセキュリティ機能を活用

#### Firebase Authentication実装方法

**必要な依存関係**
```bash
npm install firebase firebase-admin
```

**環境変数設定**
`.env.local` ファイルに以下を追加:
```
# Firebase設定
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin SDK（サーバーサイド）
FIREBASE_ADMIN_PRIVATE_KEY=your-private-key
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PROJECT_ID=your-project-id
```

**実装するファイル構成**

Firebase設定:
- `lib/firebase.ts` - Firebase クライアント設定
- `lib/firebase-admin.ts` - Firebase Admin SDK設定

API Routes:
- `app/api/admin/register/route.ts` - 管理者登録（Firebase Auth使用）
- `app/api/admin/set-claims/route.ts` - Custom Claims設定

Pages/Components:
- `app/admin/register/page.tsx` - 管理者登録フォーム
- `app/admin/page.tsx` - ログインフォーム
- `app/admin/verify-email/page.tsx` - メール認証完了ページ

### セキュリティ仕様
- **セッション制限**: 24時間で自動ログアウト
- **複数ログイン**: 同一ログインコードでの複数人同時利用を許可
- **アクセス制御**: 未認証時は認証画面に自動リダイレクト

### エラーハンドリング
| エラー条件 | メッセージ |
|-----------|-----------|
| 無効なログインコード | "入力されたログインコードが見つかりません" |
| 配布日以外のアクセス | "本日は配布日ではありません。配布日: {date}" |
| 権限不足 | 自動的に適切な認証画面にリダイレクト |
| セッション期限切れ | "セッションが期限切れです。再度ログインしてください" |

##### 6. 管理者 (`/admins/{adminId}`)
```typescript
interface Admin {
  adminId: string;
  email: string;              // st.kanazawa-it.ac.jp ドメイン
  name: string;
  isActive: boolean;
  createdAt: Date;
}
```

##### 7. 一時アカウント (`/tempAccounts/{accountId}`)
```typescript
interface TempAccount {
  accountId: string;
  teamCode: string;           // 元のログインコード
  tempEmail: string;          // 一時メールアドレス
  createdAt: Date;
  expiresAt: Date;           // 24時間後
  isActive: boolean;
}
```

##### 8. 配布履歴 (`/distributionHistory/{historyId}`)
```typescript
interface DistributionHistory {
  historyId: string;
  eventId: string;
  year: number;
  eventName: string;
  distributionDate: Date;
  totalStores: number;
  completedStores: number;
  failedStores: number;
  completionRate: number;
  teams: TeamHistory[];
  areas: AreaHistory[];
  createdAt: Date;
  archivedAt: Date;
}
```

##### 9. 年次統計 (`/yearlyStats/{year}`)
```typescript
interface YearlyStats {
  year: number;
  eventName: string;
  totalEvents: number;
  totalStores: number;
  totalTeams: number;
  totalMembers: number;
  averageCompletionRate: number;
  bestPerformingTeam: {
    teamCode: string;
    teamName: string;
    completionRate: number;
  };
  distributionTrends: {
    date: Date;
    completedStores: number;
    totalStores: number;
  }[];
}
```

---

## API設計

### REST APIエンドポイント

#### 認証関連
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| `POST` | `/api/auth/team-login` | ログインコード認証 |
| `POST` | `/api/auth/admin-login` | 管理者認証 |
| `POST` | `/api/auth/logout` | ログアウト |
| `GET` | `/api/auth/verify` | 認証状態確認 |

#### 店舗管理
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| `GET` | `/api/stores` | インテリジェント店舗一覧取得<br>・担当区域＋周辺区域の自動フィルタ<br>・五十音順ソート機能<br>・配布状況フィルタ |
| `POST` | `/api/stores` | 店舗登録（手動追加・カナ自動生成） |
| `PUT` | `/api/stores/{storeId}` | 店舗配布状況更新 |
| `GET` | `/api/stores/search` | 高度検索（クエリパラメータ：q, area, status） |

#### 区域・管理機能
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| `GET` | `/api/areas` | 配布区域一覧 |
| `POST` | `/api/areas` | 区域作成/更新 |
| `GET` | `/api/admin/stats` | 配布統計データ |
| `POST` | `/api/admin/teams` | チーム作成 |
| `POST` | `/api/admin/members/import` | 参加者CSVインポート |
| `GET` | `/api/admin/export` | データエクスポート |
| `GET` | `/api/admin/history` | 配布履歴取得 |
| `GET` | `/api/admin/yearly-stats` | 年次統計取得 |
| `GET` | `/api/admin/current-year-total` | 当年度統計取得 |
| `GET` | `/api/admin/events` | イベント一覧取得 |
| `GET` | `/api/admin/teams/{teamId}/stores` | チーム別店舗情報取得 |

#### アンケートフォーム関連
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| `GET` | `/api/forms` | フォーム一覧取得（管理者用） |
| `POST` | `/api/forms` | フォーム作成 |
| `GET` | `/api/forms/{formId}` | フォーム詳細取得 |
| `PUT` | `/api/forms/{formId}` | フォーム更新 |
| `DELETE` | `/api/forms/{formId}` | フォーム削除 |
| `GET` | `/api/forms/{formId}/responses` | 回答一覧取得（管理者用） |
| `POST` | `/api/forms/{formId}/responses` | 回答送信 |

---

## UI/UX 設計概要

### 一般ユーザー画面
1. **ログインコード入力画面** (`/`)
   - ログインコード入力フィールド
   - 注意事項表示

2. **配布管理ダッシュボード** (`/dashboard`)
   - **インテリジェント店舗リスト**: 担当＋周辺区域の自動表示
   - **五十音順ソート**: 店名→住所の常時ソート適用
   - **多段階フィルタ**: 区域・配布状況・キーワード検索
   - **配布状況更新**: ワンタップで状況変更
   - **手動店舗追加**: カナ自動生成機能付き
   - **リアルタイム進捗**: 完了率・残り件数表示

### 管理者画面
1. **管理者ログイン** (`/admin`)
   - Google認証ボタン

2. **管理者ダッシュボード** (`/admin/dashboard`)
   - 全体統計表示（班別進捗・完了率）
   - チーム管理（ログインコード発行）
   - 配布区域設定
   - メンバー管理（CSV インポート）
   - リアルタイム進捗監視（班別リスト表示）

3. **イベント管理** (`/admin/event`)
   - 年度別イベント管理
   - 配布履歴の確認・アーカイブ
   - 年次統計レポート
   - チーム別詳細データ確認

---

## 開発・デプロイ

### インフラ

| 項目 | サービス |
|-----|---------|--------|
| フロントエンド | Next.js + React |
| データベース | Firebase Firestore |
| 認証 | Firebase Authentication |
| ホスティング | Vercel |
| 検索・ソート | フロントエンド実装 |

### 開発環境セットアップ

#### 必要なアカウント・設定
1. **Google Cloud Console**
   - プロジェクト作成
   - APIキー発行・制限設定

2. **Firebase Console** 
   - プロジェクト作成
   - Authentication設定
   - Firestore設定

3. **Vercel Account**
   - GitHub連携設定
   - 環境変数設定

4. **ドメイン（オプション）**
   - 独自ドメイン取得・設定

### データプライバシー

**収集データ**
- 店舗情報（名称、住所、位置情報）
- 配布状況・統計データ
- 参加者情報（名前、学年、所属セクション）

**データ保護**
- Firebase セキュリティルールによるアクセス制御
- 学外配布日のみデータアクセス可能
- 個人情報の最小限収集

---

## 文書情報

**最終更新**: 2025年9月18日  
**作成者**: 工大祭実行委員会 PR系 平田  
**文書バージョン**: 1.1  
**更新内容**: 年度管理機能・履歴管理機能・統計レポート機能の追加
