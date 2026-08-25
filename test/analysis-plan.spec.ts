import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  outputTokenBudget,
  selectRelevantContextFiles,
  shouldAnalyzeAsMetadata,
  splitEvidence,
} from '../src/analysis-plan.js';

describe('change analysis planning', () => {
  it('splits rejected evidence without dropping content', () => {
    const evidence = Array.from({ length: 20 }, (_, index) => `line-${index}`).join('\n');
    const parts = splitEvidence(evidence);
    assert.equal(parts.join('\n'), evidence);
  });

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

  it('allows a compact evidence selection and a complete templated final response', () => {
    assert.equal(outputTokenBudget('evidence-selection'), 1024);
    assert.equal(outputTokenBudget('final-release-notes'), 2048);
    assert.equal(outputTokenBudget('final-release-notes-template'), 4096);
    assert.equal(outputTokenBudget('final-release-notes-template-capacity-retry'), 4096);
  });
});
