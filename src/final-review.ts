const evidenceMarkerPattern = /<!--\s*release-note-evidence:\s*([^>]+?)\s*-->/gi;

export function evidenceId(index: number) {
  return `G${String(index + 1).padStart(3, '0')}`;
}

export function buildEvidenceCoverageInstruction(evidenceIds: string[]) {
  const expected = evidenceIds.length > 0 ? evidenceIds.join(',') : 'NONE';
  return [
    'Reflect every distinct supported release-relevant change from each labeled change group.',
    `After doing so, append exactly this machine-readable marker as the final line: <!-- release-note-evidence: ${expected} -->`,
    'Include a group ID in that marker only after its supported changes have been reflected in the notes.',
    'The marker is validation metadata and must not be explained or placed in a code fence.',
  ].join(' ');
}

export function validateEvidenceCoverage(draft: string, expectedIds: string[]) {
  const matches = [...draft.matchAll(evidenceMarkerPattern)];
  if (matches.length !== 1) {
    return {
      valid: false,
      reason: `expected exactly one evidence marker, found ${matches.length}`,
    };
  }
  if (draft.slice(matches[0].index! + matches[0][0].length).trim()) {
    return { valid: false, reason: 'evidence marker is not the final line' };
  }

  const actual = matches[0][1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const expected = expectedIds.length > 0 ? expectedIds : ['NONE'];
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    return {
      valid: false,
      reason: `evidence marker was '${actual.join(',')}' instead of '${expected.join(',')}'`,
    };
  }

  const publishable = stripEvidenceMarker(draft);
  if (publishable.length < 20 || !/^#{1,6}\s+\S+/m.test(publishable)) {
    return { valid: false, reason: 'draft does not contain substantive Markdown release notes' };
  }
  return { valid: true, reason: '' };
}

export function stripEvidenceMarker(draft: string) {
  return draft.replace(evidenceMarkerPattern, '').trim();
}
