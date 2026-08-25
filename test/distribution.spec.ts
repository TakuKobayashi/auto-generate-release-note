import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

describe('GitHub Action distribution', () => {
  it('points action.yml at the committed JavaScript bundle', () => {
    const metadata = readFileSync('action.yml', 'utf8');
    assert.match(metadata, /node "\$GITHUB_ACTION_PATH\/dist\/index\.js"/);
    assert.doesNotMatch(metadata, /src\/index\.ts/);
  });

  it('does not expose a whole-diff truncation input', () => {
    const metadata = readFileSync('action.yml', 'utf8');
    assert.doesNotMatch(metadata, /max-diff-chars/);
    assert.doesNotMatch(metadata, /num-ctx/);
  });

  it('supports a release display name separate from the comparison ref', () => {
    const metadata = readFileSync('action.yml', 'utf8');
    assert.match(metadata, /release-name:/);
    assert.match(metadata, /INPUT_RELEASE_NAME: \$\{\{ inputs\.release-name \}\}/);
  });

  it('uses the workflow token internally instead of exposing a redundant input', () => {
    const metadata = readFileSync('action.yml', 'utf8');
    const inputSection = metadata.match(/inputs:\n([\s\S]*?)\noutputs:/)?.[1] || '';
    assert.doesNotMatch(inputSection, /^  github-token:/m);
    assert.match(metadata, /INPUT_GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  });

  it('exposes only the reviewed v2 inputs', () => {
    const metadata = readFileSync('action.yml', 'utf8');
    const inputSection = metadata.match(/inputs:\n([\s\S]*?)\noutputs:/)?.[1] || '';
    const declaredInputs = [...inputSection.matchAll(/^  ([a-z][a-z0-9-]+):$/gm)].map(
      ([, name]) => name
    );
    assert.deepEqual(declaredInputs, [
      'tag',
      'release-name',
      'model',
      'analysis-concurrency',
      'ollama-host',
      'language',
      'bilingual',
      'inference-timeout-seconds',
      'fail-on-llm-error',
      'dry-run',
      'output-file',
      'template-file',
    ]);
    assert.match(metadata, /OLLAMA_NUM_PARALLEL: \$\{\{ inputs\.analysis-concurrency \}\}/);
  });

  it('runs the bundled CLI without TypeScript tooling', () => {
    const result = spawnSync(process.execPath, ['dist/index.js', '--help'], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: node dist\/index\.js/);
  });

  it('uses this action to generate and publish repository releases', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    assert.match(workflow, /uses: \.\//);
    assert.match(workflow, /tag: \$\{\{ inputs\.tag \|\| github\.ref_name \}\}/);
    assert.doesNotMatch(workflow, /gh release create/);
  });

  it('provides a merge-approved release PR workflow', () => {
    const workflow = readFileSync('.github/workflows/release-pr.yml', 'utf8');
    assert.match(workflow, /pull_request:\s*\n\s*types: \[closed\]/);
    assert.match(workflow, /github\.event\.pull_request\.merged == true/);
    assert.match(workflow, /dry-run: 'true'/);
    assert.match(workflow, /release-name: \$\{\{ inputs\.version \}\}/);
    assert.match(workflow, /template-file: \.github\/PULL_REQUEST_TEMPLATE\/release\.md/);
    assert.match(workflow, /gh pr create/);
    assert.match(workflow, /APPROVED_NOTES: \$\{\{ github\.event\.pull_request\.body \}\}/);
    assert.match(workflow, /gh release create/);
    assert.doesNotMatch(workflow, /force/);
  });
});
