# auto-generate-release-note

English | [日本語](README-ja.md)

[![CI](https://github.com/TakuKobayashi/auto-generate-release-note/actions/workflows/ci.yml/badge.svg)](https://github.com/TakuKobayashi/auto-generate-release-note/actions/workflows/ci.yml)

A GitHub Action that uses a local [Ollama](https://ollama.com/) model to summarize Git history and diffs, then creates or updates a GitHub Release. Source-code diffs do not need to be sent to a hosted LLM API.

## Features

- Automatically compares the current tag with the previous reachable semantic-version tag
- Generates Markdown from commits, changed files, and text diffs
- Supports multiple languages, including optional bilingual output with English
- Excludes images, videos, archives, binaries, and other non-source contents from the prompt
- Falls back to deterministic notes based on commits if Ollama inference fails
- Updates an existing release for the tag or creates one when it does not exist

## Usage

Create `.github/workflows/release.yml` in the repository that will use this action.

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
          language: en
```

`fetch-depth: 0` is required so the action can read previous tags and diffs. The workflow also needs `contents: write` permission to create or update a release.

On its first run, the action installs Ollama and the default model on a GitHub-hosted Linux runner. Model downloads and CPU inference can take time. For faster execution, use a self-hosted runner with Ollama already installed.

### Generate both Japanese and English

```yaml
- uses: TakuKobayashi/auto-generate-release-note@v1
  with:
    github-token: ${{ github.token }}
    language: ja
    bilingual: 'true'
```

### Preview without publishing a release

```yaml
- uses: TakuKobayashi/auto-generate-release-note@v1
  with:
    github-token: ${{ github.token }}
    dry-run: 'true'
    output-file: release-notes-preview.md
```

## Inputs

| Name                        | Required | Default                     | Description                                                          |
| --------------------------- | -------- | --------------------------- | -------------------------------------------------------------------- |
| `github-token`              | Yes      | -                           | GitHub token with `contents: write`; normally `${{ github.token }}`. |
| `tag`                       | No       | `${{ github.ref_name }}`    | Tag for the GitHub Release.                                          |
| `model`                     | No       | `qwen2.5-coder:7b-instruct` | Ollama model used for generation.                                    |
| `ollama-host`               | No       | `http://127.0.0.1:11434`    | Base URL of the Ollama API.                                          |
| `language`                  | No       | `en`                        | Output language. Both `ja` and `jp` select Japanese.                 |
| `bilingual`                 | No       | `false`                     | Generates English and the selected language.                         |
| `max-diff-chars`            | No       | `30000`                     | Maximum number of text-diff characters sent to the model.            |
| `num-ctx`                   | No       | `16384`                     | Ollama context-window size.                                          |
| `inference-timeout-seconds` | No       | `600`                       | Inactivity timeout after Ollama starts streaming its response.       |
| `fail-on-llm-error`         | No       | `false`                     | Fails the action instead of generating fallback notes.               |
| `dry-run`                   | No       | `false`                     | Generates notes without creating or updating a release.              |
| `output-file`               | No       | Empty                       | File path where generated Markdown is written.                       |

## Outputs

| Name           | Description                                                         |
| -------------- | ------------------------------------------------------------------- |
| `release-url`  | URL of the created or updated release; empty in dry-run mode.       |
| `previous-tag` | Previous semantic-version tag used as the comparison base.          |
| `used-llm`     | `true` when Ollama generated the notes; `false` for fallback notes. |

Reference an output from a later step with syntax such as `${{ steps.release-notes.outputs.release-url }}`.

## Behavior and security

Comparison tags use formats such as `v1.2.3`, `1.2.3`, and `v1.2.3-beta.1`. The model receives non-merge commit subjects and authors, changed-file statistics, and eligible text diffs.

The prompt instructs the model to treat text from diffs as untrusted input, but you should still review LLM output before publishing it. When an external `ollama-host` is configured, diff data is sent to that host. In third-party workflows, pinning this action to a complete commit SHA provides stronger supply-chain protection than a moving version tag.

## Local preview

Install Node.js, Git, and Ollama, then run the command from the target repository root.

```powershell
ollama pull qwen2.5-coder:7b-instruct
# Run ollama serve in another terminal first when necessary.
node path/to/dist/index.js `
  --dry-run `
  --language en `
  --output-file release-notes-preview.md
```

Add `--tag v1.2.3` to preview an existing tag. Run `node dist/index.js --help` to see all options.

## Development

TypeScript source is stored in `src/`, and specs are stored in `test/`. The Marketplace executes the generated `dist/index.js`, which must be committed so it is included in each release.

```bash
npm install
npm run format
npm run verify
```

`npm run format` formats TypeScript, JSON, YAML, Markdown, and other supported files with Prettier. `npm run verify` checks formatting, type-checks the source, builds the distribution, and runs the specs. Commit the updated `dist/index.js` whenever the source changes.

## Publishing to GitHub Marketplace

1. Make this repository public on GitHub.
2. Push the changes to the `main` branch.
3. Create and push a tag such as `v1` or `v1.0.0`.
4. The Release workflow validates formatting, types, the build, specs, and the committed distribution. It then runs this action itself, generates release notes with Ollama, and creates or updates the GitHub Release with the generated Markdown. Once the tag is pushed, the action can be used as `TakuKobayashi/auto-generate-release-note@v1`.
5. For the first Marketplace publication only, edit the generated release on GitHub and select **Publish this Action to the GitHub Marketplace**.
6. Select a category such as Utilities and update the release. The first publication requires acceptance of the Marketplace Developer Agreement and two-factor authentication.

The public GitHub API does not expose the Marketplace publication checkbox, so steps 5 and 6 require a one-time operation in the GitHub UI. GitHub Release creation and action distribution are automated.

To regenerate the notes for an existing tag, open **Actions → Release → Run workflow**, enter the tag, and run the workflow. The existing release body will be replaced with newly generated notes.

```bash
git tag -a v1.0.0 -m "v1.0.0"
git tag -a v1 -m "v1"
git push origin v1.0.0 v1
```

The action name must be unique across GitHub Marketplace. If GitHub reports a conflict during publication, update `name` in `action.yml`.

## License

[MIT License](LICENSE)
