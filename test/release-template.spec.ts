import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  assertTemplateScaffoldingPreserved,
  buildTemplateApplicationPrompt,
  buildTemplateReviewPrompt,
} from '../src/release-template.js';

describe('release pull-request template', () => {
  it('gives the model the complete sample template and generated notes', () => {
    const template = readFileSync('.github/PULL_REQUEST_TEMPLATE/release.md', 'utf8');
    const notes = '## Added\n\n- Added release approval automation.';
    const prompt = buildTemplateApplicationPrompt(template, notes, 'v2.0.0');

    assert.match(prompt, /release 'v2\.0\.0'/);
    assert.match(prompt, /<pull_request_template>[\s\S]*## Release notes/);
    assert.match(prompt, /<generated_release_notes>[\s\S]*Added release approval automation/);
    assert.match(prompt, /Preserve the complete template structure/);
    assert.match(prompt, /Do not mark checkboxes/);
    assert.match(template, /- \[ \] The version number is correct/);
  });

  it('reviews the populated result against the original template', () => {
    const template = readFileSync('.github/PULL_REQUEST_TEMPLATE/release.md', 'utf8');
    const prompt = buildTemplateReviewPrompt(template, '- Added a feature.', 'draft', 'v2.0.0');
    assert.match(prompt, /<original_template>/);
    assert.match(prompt, /<populated_template_to_review>\ndraft/);
  });

  it('accepts populated notes only when protected template scaffolding remains', () => {
    const template = readFileSync('.github/PULL_REQUEST_TEMPLATE/release.md', 'utf8');
    const populated = template.replace(
      '_The generated release notes will be inserted here._',
      '### Added\n\n- Added a feature.'
    );
    assert.doesNotThrow(() => assertTemplateScaffoldingPreserved(template, populated));
    assert.throws(
      () => assertTemplateScaffoldingPreserved(template, '## Release notes\n\n- Added a feature.'),
      /did not preserve required template structure/
    );
  });
});
