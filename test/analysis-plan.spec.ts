import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAnalysisTasks,
  outputTokenBudget,
  relatedGroup,
  selectProjectContextFiles,
  shouldAnalyzeAsMetadata,
  splitEvidence,
} from '../src/analysis-plan.js';

describe('change analysis planning', () => {
  it('groups files from the same package and automation area', () => {
    assert.equal(relatedGroup('packages/ai/src/analyzer.ts'), 'packages/ai');
    assert.equal(relatedGroup('packages/ai/test/analyzer.spec.ts'), 'packages/ai');
    assert.equal(relatedGroup('.github/workflows/release.yml'), '.github');
    assert.equal(relatedGroup('README.md'), 'repository root');
  });

  it('combines related files without imposing a first-attempt size limit', () => {
    const first = 'A'.repeat(1700);
    const second = 'B'.repeat(900);
    const tasks = createAnalysisTasks([
      { filePath: 'packages/ai/src/a.ts', content: first },
      { filePath: 'packages/ai/src/b.ts', content: second },
    ]);

    assert.equal(tasks.length, 1);
    assert.match(tasks[0].evidence, new RegExp(`A{${first.length}}`));
    assert.match(tasks[0].evidence, new RegExp(`B{${second.length}}`));
  });

  it('splits evidence only for capacity-error fallback without dropping content', () => {
    const evidence = Array.from({ length: 20 }, (_, index) => `line-${index}`).join('\n');
    const parts = splitEvidence(evidence);
    assert.equal(parts.join('\n'), evidence);
  });

  it('recognizes files that should be inferred from metadata instead of full contents', () => {
    assert.equal(shouldAnalyzeAsMetadata('pnpm-lock.yaml'), true);
    assert.equal(shouldAnalyzeAsMetadata('Assets/Scenes/Main.unity'), true);
    assert.equal(shouldAnalyzeAsMetadata('dist/index.js'), true);
    assert.equal(shouldAnalyzeAsMetadata('src/index.ts'), false);
  });

  it('selects manifests and documentation for project understanding', () => {
    assert.deepEqual(
      selectProjectContextFiles(['src/index.ts', 'README.md', 'packages/app/package.json']),
      ['README.md', 'packages/app/package.json']
    );
  });

  it('keeps intermediate analysis concise while allowing longer final notes', () => {
    assert.equal(outputTokenBudget('analysis-1/8-packages/source'), 768);
    assert.equal(outputTokenBudget('project-profile'), 1024);
    assert.equal(outputTokenBudget('final-release-notes'), 2048);
  });
});
