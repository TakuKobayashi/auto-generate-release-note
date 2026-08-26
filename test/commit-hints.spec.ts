import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSurvivingCommitHints,
  extractAddedLineRanges,
  parseCommitCandidates,
} from '../src/commit-hints.js';

describe('surviving commit hints', () => {
  it('extracts exact target ranges for added lines', () => {
    const ranges = extractAddedLineRanges(
      ['@@ -10,4 +10,5 @@', ' context', '-removed', '+added', '+another', ' context'].join('\n')
    );
    assert.deepEqual(ranges, [{ start: 11, end: 12 }]);
  });

  it('keeps only commits whose changes survive in the final diff', () => {
    const commits = parseCommitCandidates(
      [
        `${'a'.repeat(40)}\taaaaaaa Add configurable concurrency (Dev)`,
        `${'b'.repeat(40)}\tbbbbbbb Revert configurable concurrency (Dev)`,
        `${'c'.repeat(40)}\tccccccc Generate notes with one model call (Dev)`,
      ].join('\n')
    );
    const hints = buildSurvivingCommitHints({
      commits,
      patches: [
        {
          filePath: 'src/index.ts',
          content: '@@ -4,1 +4,1 @@\n-oldPipeline();\n+oneModelCall();',
        },
      ],
      metadataFilePaths: [],
      blameHashes: () => ['c'.repeat(40)],
      latestHash: () => '',
    });

    assert.deepEqual(
      hints.map(({ display }) => display),
      ['ccccccc Generate notes with one model call (Dev)']
    );
  });

  it('uses the latest touching commit for deletion-only and metadata changes', () => {
    const commits = parseCommitCandidates(
      `${'d'.repeat(40)}\tddddddd Remove obsolete option (Dev)\n${'e'.repeat(40)}\teeeeeee Update dependencies (Dev)`
    );
    const hints = buildSurvivingCommitHints({
      commits,
      patches: [{ filePath: 'src/old.ts', content: '@@ -1,1 +0,0 @@\n-obsolete();' }],
      metadataFilePaths: ['package-lock.json'],
      blameHashes: () => [],
      latestHash: (path) => (path === 'src/old.ts' ? 'd'.repeat(40) : 'e'.repeat(40)),
    });

    assert.deepEqual(
      hints.map(({ display }) => display),
      ['ddddddd Remove obsolete option (Dev)', 'eeeeeee Update dependencies (Dev)']
    );
  });
});
