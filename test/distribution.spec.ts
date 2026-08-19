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
});
