import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildTemplateReleaseNotesInstruction } from '../src/release-template.js';

describe('release pull-request template', () => {
  it('asks the final writer to populate the complete template directly', () => {
    const template = readFileSync('.github/PULL_REQUEST_TEMPLATE/release.md', 'utf8');
    const prompt = buildTemplateReleaseNotesInstruction(template, 'v2.0.0');

    assert.match(prompt, /release 'v2\.0\.0'/);
    assert.match(prompt, /<pull_request_template>[\s\S]*## Release notes/);
    assert.match(prompt, /Preserve the complete template structure/);
    assert.match(prompt, /Do not mark checkboxes/);
    assert.doesNotMatch(prompt, /review/i);
  });
});
