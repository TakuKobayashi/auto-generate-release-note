# auto-generate-release-note

[English](README.md) | 日本語

[![CI](https://github.com/TakuKobayashi/auto-generate-release-note/actions/workflows/ci.yml/badge.svg)](https://github.com/TakuKobayashi/auto-generate-release-note/actions/workflows/ci.yml)

Gitのコミット履歴と差分をローカルの[Ollama](https://ollama.com/)で要約し、GitHub Releaseを自動作成・更新するGitHub Actionです。ソースコードの差分を外部のLLM APIへ送らずにリリースノートを生成できます。

## 特長

- 現在のタグと、到達可能な直前のセマンティックバージョンタグを自動比較
- コミット、変更ファイル、テキスト差分からMarkdownを生成
- 日本語を含む任意の言語と、英語との二言語出力に対応
- 画像、動画、アーカイブ、バイナリなどの内容をプロンプトから除外
- Ollamaでエラーが起きても、既定ではコミット一覧を使ったリリースノートへフォールバック
- 同じタグのReleaseが存在する場合は更新し、存在しない場合は新規作成

## 使い方

利用するリポジトリに `.github/workflows/release.yml` を作成します。

```yaml
name: Create release notes

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Generate release notes
        id: release-notes
        uses: TakuKobayashi/auto-generate-release-note@v2
        with:
          language: ja
```

`fetch-depth: 0` は過去のタグと差分を取得するために必要です。ワークフローにはReleaseを書き込むための `contents: write` 権限も必要です。

正式なRepository Releaseでは、モデルのインストールや推論に失敗したときにフォールバック文面を公開せずWorkflowを停止するため、`fail-on-llm-error: 'true'`を指定してください。同梱のタグRelease Workflowではこの設定を有効にしています。

初回実行時、GitHub-hosted Linux runnerにはOllamaと既定モデルが自動インストールされます。モデルのダウンロードとCPU推論には時間がかかるため、Ollamaを用意したself-hosted runnerを使うと高速化できます。

### 日本語と英語の両方を生成する

```yaml
- uses: TakuKobayashi/auto-generate-release-note@v2
  with:
    language: ja
    bilingual: 'true'
```

### 生成結果だけを確認する

```yaml
- uses: TakuKobayashi/auto-generate-release-note@v2
  with:
    dry-run: 'true'
    output-file: release-notes-preview.md
```

## Inputs

| 名前                        | 必須   | 既定値                      | 説明                                                         |
| --------------------------- | ------ | --------------------------- | ------------------------------------------------------------ |
| `tag`                       | いいえ | `${{ github.ref_name }}`    | Releaseの対象タグ。                                          |
| `release-name`              | いいえ | `tag`の値                   | 生成結果とGitHub Releaseに表示する名前。                     |
| `comparison-base`           | いいえ | 空                          | 明示的な比較元のbranch、tag、またはcommit。                  |
| `comparison-target`         | いいえ | 空                          | 明示的な比較元と比較するbranch、tag、またはcommit。          |
| `model`                     | いいえ | `qwen2.5-coder:7b-instruct` | 使用するOllamaモデル。                                       |
| `ollama-host`               | いいえ | `http://127.0.0.1:11434`    | Ollama APIのベースURL。                                      |
| `language`                  | いいえ | `en`                        | 出力言語。日本語は `ja` または `jp`。                        |
| `bilingual`                 | いいえ | `false`                     | 英語と指定言語の両方を生成。                                 |
| `inference-timeout-seconds` | いいえ | `600`                       | Ollamaが応答を開始した後のストリーム無通信タイムアウト秒数。 |
| `fail-on-llm-error`         | いいえ | `false`                     | `true` ならフォールバックせずActionを失敗させる。            |
| `dry-run`                   | いいえ | `false`                     | Releaseを変更せず生成結果だけを出力。                        |
| `output-file`               | いいえ | 空                          | 生成したMarkdownの保存先。                                   |
| `template-file`             | いいえ | 空                          | 生成したリリースノートを挿入するMarkdownテンプレート。       |

## Outputs

| 名前                | 説明                                                        |
| ------------------- | ----------------------------------------------------------- |
| `release-url`       | 作成または更新したReleaseのURL。dry-runでは空。             |
| `previous-tag`      | 比較元に使用した直前のセマンティックバージョンタグ。        |
| `comparison-base`   | 実際の比較元として使用したcommit SHA。                      |
| `comparison-target` | 実際の比較先として使用したcommit SHA。                      |
| `used-llm`          | Ollamaで生成した場合は `true`、フォールバック時は `false`。 |

後続ステップから `${{ steps.release-notes.outputs.release-url }}` のように参照できます。

## 動作仕様とセキュリティ

比較対象は `v1.2.3`、`1.2.3`、`v1.2.3-beta.1` のようなタグです。マージコミットを除いたコミット件名・作者、変更統計、テキスト差分をモデルへ渡します。

通常経路のモデル呼び出しは1回です。その前に、すべてのdiff hunkをローカルで意味情報へ変換し、所属範囲、変更された宣言、公開シンボル、設定キー、オプション、route、test、import、呼び出し、条件、結果、意味のある文字列を含むコンパクトな要約を作成します。最終生成には、この完全な要約と直接関係するプロジェクト情報を渡し、`template-file`があればテンプレート全文もそのまま渡します。変更されたという理由だけで実装本文を渡すことはありません。コミットメッセージやパスは有用ではあるものの不正確な可能性がある補助的な証拠として扱います。モデルによる選別、統合、検証、自己レビューは行わず、生成結果は人間が確認・編集する下書きとして扱います。

文字数やコンテキストサイズを理由にdiffを破棄しません。すべてのhunkがローカルで作成する意味情報の要約へ反映され、生成物など本文を扱うのに適さないファイルもメタデータとして残ります。1回の生成リクエストがOllamaの物理容量を超えた場合は、時間のかかる分析や再試行を連鎖させず、通常のLLMエラー処理を行います。

### バージョンタグを使わずrelease branchを比較する

`comparison-base`と`comparison-target`を両方指定すると、セマンティックバージョンタグの探索を行わず、任意のbranch、tag、commit SHA同士を比較します。[production向けサンプルworkflow](examples/production-release-notes.yml)では、`production`向けPRイベントに記録されたbase SHAとhead SHAを比較し、生成結果でPR本文を更新します。`production`や`release-candidate`のようなbranch名も指定でき、ローカルbranchが存在しない場合は対応する`origin/<branch>`を自動的に解決します。

明示的な比較refは分析対象だけを制御します。GitHub Releaseを作らずPR本文だけを生成する場合は`dry-run: 'true'`を使用します。GitHub Releasesの項目を作成する場合は、GitHubの仕様上引き続き`tag`が必要です。

差分内の文章は信頼できない入力として扱うようモデルへ指示していますが、LLMの出力は公開前に確認してください。外部の `ollama-host` を指定すると差分データはそのホストへ送信されます。第三者のワークフローでは完全なコミットSHAでActionを固定すると、より強いサプライチェーン保護になります。

## ローカルでプレビューする

Node.js、Git、Ollamaを用意し、対象リポジトリのルートで実行します。

```powershell
ollama pull qwen2.5-coder:7b-instruct
# 必要なら別ターミナルで ollama serve を実行
node path/to/dist/index.js `
  --dry-run `
  --language ja `
  --output-file release-notes-preview.md
```

既存タグを確認する場合は `--tag v1.2.3` を追加します。全オプションは `node dist/index.js --help` で確認できます。
バージョンタグを使わずbranch差分から生成する場合は、`--comparison-base production --comparison-target feature/example`を指定します。

## 開発

実装はTypeScriptで `src/`、specは `test/` に配置しています。Marketplaceから実行される `dist/index.js` はビルド成果物であり、Releaseへ含めるためGitへコミットします。

```bash
npm install
npm run format
npm run verify
```

`npm run format` はTypeScript、JSON、YAML、MarkdownなどをPrettierで整形します。`npm run verify` はフォーマット確認、型チェック、配布ファイルのビルド、specを順番に実行します。ソースを変更した場合は、更新された `dist/index.js` もコミットしてください。

## Marketplaceへ公開する（メンテナー向け）

1. このリポジトリをGitHub上でPublicにします。
2. 変更をmainブランチへpushします。
3. `v1`、`v1.0.0` のようなタグを作成してpushします。
4. Releaseワークフローがフォーマット、型、ビルド、spec、配布ファイルを検証します。その後、このAction自身を実行してOllamaでリリースノートを生成し、生成されたMarkdownを本文にしたGitHub Releaseを作成または更新します。タグをpushした時点で `TakuKobayashi/auto-generate-release-note@v2` のように利用できます。
5. Marketplaceへ初めて掲載するときだけ、作成されたReleaseをGitHub上で編集し、**Publish this Action to the GitHub Marketplace** を選択します。
6. カテゴリ（例: Utilities）を選んで更新します。初回はMarketplace Developer Agreementへの同意と2要素認証が必要です。

GitHubの公開APIにはMarketplace掲載チェックを設定する項目がないため、手順5〜6のみ画面上での操作が必要です。GitHub Releaseの作成と、それ以降のAction配布は自動化されています。

既存タグのリリースノートを再生成する場合は、**Actions → Release → Run workflow** を開き、対象タグを入力して実行します。既存Releaseの本文が、新しく生成された内容へ更新されます。

```bash
git tag -a v1.0.0 -m "v1.0.0"
git tag -a v1 -m "v1"
git push origin v1.0.0 v1
```

Action名はMarketplace全体で一意である必要があります。公開画面で競合が表示された場合は、`action.yml` の `name` を変更してください。

## ライセンス

[MIT License](LICENSE)
