import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildChangeIndex,
  buildContextDigest,
  formatChangeIndex,
  parseEvidenceSelection,
} from '../src/change-index.js';

describe('selective diff evidence', () => {
  it('indexes every hunk with code and configuration signals', () => {
    const entries = buildChangeIndex(
      [
        {
          filePath: 'src/api.ts',
          content: [
            'diff --git a/src/api.ts b/src/api.ts',
            '@@ -1,2 +1,4 @@ export function request()',
            '-const endpoint = "/api/old";',
            '+export function createRelease() {',
            '+  const endpoint = "/api/releases";',
            '+}',
            '@@ -20,1 +22,1 @@ function parseArgs()',
            '-const option = "--old";',
            '+const option = "--comparison-base";',
          ].join('\n'),
        },
      ],
      'M\tdist/index.js\n10\t2\tdist/index.js'
    );

    assert.equal(entries.length, 3);
    assert.deepEqual(
      entries.map(({ id }) => id),
      ['H0001', 'H0002', 'H0003']
    );
    const index = formatChangeIndex(entries);
    assert.match(index, /declaration:createRelease/);
    assert.match(index, /route:\/api\/releases/);
    assert.match(index, /option:--comparison-base/);
    assert.match(index, /metadata:M\s+dist\/index\.js/);
    assert.doesNotMatch(index, /const endpoint/);
  });

  it('creates a compact digest instead of copying complete context files', () => {
    const digest = buildContextDigest([
      {
        path: 'README.md',
        content: '# Example\n\nA release-note generator.\n\n## Usage\n\nLong instructions.',
      },
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'example',
          description: 'Generates notes',
          scripts: { test: 'node --test' },
          dependencies: { ollama: '1.0.0' },
        }),
      },
    ]);

    assert.match(digest, /A release-note generator/);
    assert.match(digest, /## Usage/);
    assert.match(digest, /"dependencies":\["ollama"\]/);
    assert.doesNotMatch(digest, /Long instructions/);
    assert.doesNotMatch(digest, /node --test/);
  });

  it('accepts only known selected hunk IDs', () => {
    assert.deepEqual(
      parseEvidenceSelection('```json\n{"selected_ids":["H0002","unknown","H0002"]}\n```', [
        'H0001',
        'H0002',
      ]),
      ['H0002']
    );
    assert.throws(() => parseEvidenceSelection('{}', ['H0001']), /selected_ids/);
  });
});
