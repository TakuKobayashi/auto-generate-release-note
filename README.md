# Ollama AI Release Notes

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
        uses: TakuKobayashi/auto-generate-release-note@v1
        with:
          github-token: ${{ github.token }}
          language: ja
```

`fetch-depth: 0` は過去のタグと差分を取得するために必要です。ワークフローにはReleaseを書き込むための `contents: write` 権限も必要です。

初回実行時、GitHub-hosted Linux runnerにはOllamaと既定モデルが自動インストールされます。モデルのダウンロードとCPU推論には時間がかかるため、Ollamaを用意したself-hosted runnerを使うと高速化できます。

### 日本語と英語の両方を生成する

```yaml
- uses: TakuKobayashi/auto-generate-release-note@v1
  with:
    github-token: ${{ github.token }}
    language: ja
    bilingual: 'true'
```

### 生成結果だけを確認する

```yaml
- uses: TakuKobayashi/auto-generate-release-note@v1
  with:
    github-token: ${{ github.token }}
    dry-run: 'true'
    output-file: release-notes-preview.md
```

## Inputs

| 名前 | 必須 | 既定値 | 説明 |
| --- | --- | --- | --- |
| `github-token` | はい | - | `contents: write` 権限を持つtoken。通常は `${{ github.token }}`。 |
| `tag` | いいえ | `${{ github.ref_name }}` | Releaseの対象タグ。 |
| `model` | いいえ | `qwen2.5-coder:7b-instruct` | 使用するOllamaモデル。 |
| `ollama-host` | いいえ | `http://127.0.0.1:11434` | Ollama APIのベースURL。 |
| `language` | いいえ | `en` | 出力言語。日本語は `ja` または `jp`。 |
| `bilingual` | いいえ | `false` | 英語と指定言語の両方を生成。 |
| `max-diff-chars` | いいえ | `30000` | モデルへ渡すテキスト差分の最大文字数。 |
| `num-ctx` | いいえ | `16384` | Ollamaのコンテキストサイズ。 |
| `inference-timeout-seconds` | いいえ | `600` | Ollamaから通信がない場合のタイムアウト秒数。 |
| `fail-on-llm-error` | いいえ | `false` | `true` ならフォールバックせずActionを失敗させる。 |
| `dry-run` | いいえ | `false` | Releaseを変更せず生成結果だけを出力。 |
| `output-file` | いいえ | 空 | 生成したMarkdownの保存先。 |

## Outputs

| 名前 | 説明 |
| --- | --- |
| `release-url` | 作成または更新したReleaseのURL。dry-runでは空。 |
| `previous-tag` | 比較元に使用した直前のセマンティックバージョンタグ。 |
| `used-llm` | Ollamaで生成した場合は `true`、フォールバック時は `false`。 |

後続ステップから `${{ steps.release-notes.outputs.release-url }}` のように参照できます。

## 動作仕様とセキュリティ

比較対象は `v1.2.3`、`1.2.3`、`v1.2.3-beta.1` のようなタグです。マージコミットを除いたコミット件名・作者、変更統計、テキスト差分をモデルへ渡します。

差分内の文章は信頼できない入力として扱うようモデルへ指示していますが、LLMの出力は公開前に確認してください。外部の `ollama-host` を指定すると差分データはそのホストへ送信されます。第三者のワークフローでは完全なコミットSHAでActionを固定すると、より強いサプライチェーン保護になります。

## ローカルでプレビューする

Node.js 24以降、Git、Ollamaを用意し、対象リポジトリのルートで実行します。

```powershell
ollama pull qwen2.5-coder:7b-instruct
# 必要なら別ターミナルで ollama serve を実行
node path/to/dist/index.js `
  --dry-run `
  --language ja `
  --output-file release-notes-preview.md
```

既存タグを確認する場合は `--tag v1.2.3` を追加します。全オプションは `node dist/index.js --help` で確認できます。

## 開発

実装はTypeScriptで `src/`、specは `test/` に配置しています。Marketplaceから実行される `dist/index.js` はビルド成果物であり、Releaseへ含めるためGitへコミットします。

```bash
npm install
npm run verify
```

`npm run verify` は型チェック、配布ファイルのビルド、specを順番に実行します。ソースを変更した場合は、更新された `dist/index.js` もコミットしてください。

## Marketplaceへ公開する（メンテナー向け）

1. このリポジトリをGitHub上でPublicにします。
2. 変更をmainブランチへpushします。
3. `v1.0.0` のようなタグを作成してpushします。
4. GitHubのReleasesで新しいReleaseを作成し、**Publish this Action to the GitHub Marketplace** を選択します。
5. カテゴリ（例: Utilities）を選び、Releaseを公開します。初回はMarketplace Developer Agreementへの同意と2要素認証が必要です。
6. 利用者が `@v1` で互換性のある最新版を使えるよう、`v1` タグも同じコミットへ作成・更新します。

```bash
git tag -a v1.0.0 -m "v1.0.0"
git tag -a v1 -m "v1"
git push origin v1.0.0 v1
```

Action名はMarketplace全体で一意である必要があります。公開画面で競合が表示された場合は、`action.yml` の `name` を変更してください。

## ライセンス

[MIT License](LICENSE)
