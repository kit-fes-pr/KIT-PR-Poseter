# .github リポジトリ

このリポジトリは、全リポジトリに共通のGitHub設定を管理する特殊リポジトリです。

## 概要

このリポジトリには以下が含まれています：

- **Issueテンプレート**: バグ報告、機能追加、ドキュメント改善、リファクタリング、その他
- **Pull Requestテンプレート**: PRの標準フォーマット
- **ラベル設定ワークフロー**: 新規リポジトリに統一ラベルを自動設定
- **手動ラベル設定スクリプト**: 既存リポジトリにラベルを一括設定

## ディレクトリ構成

```
.github/
├── ISSUE_TEMPLATE/          # Issueテンプレート（全リポジトリで利用可能）
│   ├── bug.yml              # バグ報告
│   ├── feature.yml          # 機能追加
│   ├── documentation.yml    # ドキュメント改善
│   ├── refactor.yml         # リファクタリング
│   ├── performance.yml      # その他（ビルド・設定変更）
│   └── config.yml           # テンプレート設定
├── PULL_REQUEST_TEMPLATE.md # PRテンプレート（全リポジトリで利用可能）
├── workflows/               # ワークフローテンプレート
│   └── setup-labels.yml     # ラベル自動設定ワークフロー
├── scripts/                 # ユーティリティスクリプト
│   └── create-labels.sh     # 手動ラベル設定スクリプト
├── docs/                    # ドキュメント
│   ├── setup.md             # セットアップガイド
│   ├── customization.md     # カスタマイズガイド
│   └── troubleshooting.md   # トラブルシューティング
├── CONTRIBUTING.md          # コントリビューションガイド
└── LICENSE                  # MITライセンス
```

## 統一ラベル

以下のラベルが全リポジトリで使用されます：

| ラベル | 色 | 説明 |
|--------|------|------|
| `bug` | 🔴 赤 | バグ報告 |
| `feature` | 🔵 青 | 新機能追加 |
| `docs` | 🔵 濃青 | ドキュメント改善 |
| `refactor` | 🟡 黄 | リファクタリング |
| `other` | 🟣 紫 | その他（ビルド・設定変更など） |

## 使い方

### 1. 新規リポジトリへのラベル自動設定（推奨）

新規リポジトリ作成時に、[別のアプリケーション](https://github.com/rikut0904/github_label_create)から以下を実行：

1. `workflows/setup-labels.yml` を取得
2. 新規リポジトリの `.github/workflows/setup-labels.yml` として配置
3. GitHub Appの認証情報をシークレットに登録：
   - `APP_ID`: GitHub AppのID
   - `APP_PRIVATE_KEY`: GitHub Appの秘密鍵
4. mainブランチにpushすると自動実行
5. 実行完了後、アプリ側でワークフローファイルを削除

> **詳細:** [セットアップガイド](./docs/setup.md)

### 2. 既存リポジトリへの手動ラベル設定

複数の既存リポジトリに一括でラベルを設定する場合：

```bash
# 自分のすべてのリポジトリに適用
./scripts/create-labels.sh

# 特定のowner/organizationのすべてのリポジトリに適用
./scripts/create-labels.sh [owner名]
```

**注意事項:**
- GitHub CLIの認証が必要（`gh auth login`）
- 既存のラベルはすべて削除されます
- 実行前に対象リポジトリを確認することを推奨

### 3. Issueテンプレートの利用

このリポジトリが存在することで、organizationまたはアカウント配下の全リポジトリで自動的にIssueテンプレートが利用可能になります。

新しいIssueを作成する際、以下のテンプレートから選択できます：
- バグ報告
- 機能追加
- ドキュメント改善
- リファクタリング
- その他

### 4. Pull Requestテンプレート

PRを作成すると、自動的にテンプレートが適用されます。

## ドキュメント

- [セットアップガイド](./docs/setup.md) - GitHub Appの設定とシークレット登録
- [カスタマイズガイド](./docs/customization.md) - ラベルやテンプレートのカスタマイズ方法
- [トラブルシューティング](./docs/troubleshooting.md) - よくある問題と解決方法

## コントリビューション

コントリビューションを歓迎します！[コントリビューションガイド](./CONTRIBUTING.md)を参照してください。

## ライセンス

このプロジェクトは [MIT License](./LICENSE) の下で公開されています。

## 参考資料

- [GitHub Issue templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)
- [GitHub Actions create-github-app-token](https://github.com/actions/create-github-app-token)
- [GitHub CLI Manual](https://cli.github.com/manual/)
