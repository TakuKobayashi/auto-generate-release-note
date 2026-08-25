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
    assert.match(workflow, /github-token: \$\{\{ github\.token \}\}/);
    assert.match(workflow, /tag: \$\{\{ inputs\.tag \|\| github\.ref_name \}\}/);
    assert.doesNotMatch(workflow, /gh release create/);
  });

  it('provides a merge-approved release PR workflow', () => {
    const workflow = readFileSync('.github/workflows/release-pr.yml', 'utf8');
    assert.match(workflow, /pull_request:\s*\n\s*types: \[closed\]/);
    assert.match(workflow, /github\.event\.pull_request\.merged == true/);
    assert.match(workflow, /dry-run: 'true'/);
    assert.match(workflow, /release-name: \$\{\{ inputs\.version \}\}/);
    assert.match(workflow, /gh pr create/);
    assert.match(workflow, /APPROVED_NOTES: \$\{\{ github\.event\.pull_request\.body \}\}/);
    assert.match(workflow, /gh release create/);
    assert.doesNotMatch(workflow, /force/);
  });
});
