import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  outputTokenBudget,
  selectRelevantContextFiles,
  shouldAnalyzeAsMetadata,
} from '../src/analysis-plan.js';

describe('change analysis planning', () => {
  it('recognizes files represented by metadata instead of bulk contents', () => {
    assert.equal(shouldAnalyzeAsMetadata('pnpm-lock.yaml'), true);
    assert.equal(shouldAnalyzeAsMetadata('Assets/Scenes/Main.unity'), true);
    assert.equal(shouldAnalyzeAsMetadata('dist/index.js'), true);
    assert.equal(shouldAnalyzeAsMetadata('src/index.ts'), false);
  });

  it('selects root context and context belonging to changed project areas', () => {
    assert.deepEqual(
      selectRelevantContextFiles(
        [
          'README.md',
          'package.json',
          'packages/api/README.md',
          'packages/api/package.json',
          'packages/web/README.md',
        ],
        ['packages/api/src/index.ts']
      ),
      ['README.md', 'package.json', 'packages/api/README.md', 'packages/api/package.json']
    );
  });

  it('does not duplicate a context file already supplied as a diff', () => {
    assert.deepEqual(selectRelevantContextFiles(['README.md', 'package.json'], ['README.md']), [
      'package.json',
    ]);
  });

  it('allows complete final and templated responses', () => {
    assert.equal(outputTokenBudget('final-release-notes'), 2048);
    assert.equal(outputTokenBudget('final-release-notes-template'), 4096);
  });
});
