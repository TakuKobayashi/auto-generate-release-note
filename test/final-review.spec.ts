import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEvidenceCoverageInstruction,
  evidenceId,
  stripEvidenceMarker,
  validateEvidenceCoverage,
} from '../src/final-review.js';

describe('final release-note evidence validation', () => {
  it('accepts complete ordered coverage and removes internal metadata', () => {
    const draft =
      '# Changes\n\n- Added branch comparisons.\n\n<!-- release-note-evidence: G001,G002 -->';
    assert.equal(validateEvidenceCoverage(draft, ['G001', 'G002']).valid, true);
    assert.equal(stripEvidenceMarker(draft), '# Changes\n\n- Added branch comparisons.');
  });

  it('requires review when a group is omitted', () => {
    const result = validateEvidenceCoverage(
      '# Changes\n\n- Added caching.\n\n<!-- release-note-evidence: G001 -->',
      ['G001', 'G002']
    );
    assert.equal(result.valid, false);
    assert.match(result.reason, /instead of/);
  });

  it('requires the internal marker to be the final line', () => {
    const result = validateEvidenceCoverage(
      '<!-- release-note-evidence: G001 -->\n\n# Changes\n\n- Added caching.',
      ['G001']
    );
    assert.equal(result.valid, false);
    assert.match(result.reason, /final line/);
  });

  it('uses stable padded IDs and an exact requested marker', () => {
    assert.equal(evidenceId(8), 'G009');
    assert.match(buildEvidenceCoverageInstruction(['G001']), /G001/);
  });
});
