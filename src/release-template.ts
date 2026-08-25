export function buildTemplateApplicationPrompt(
  template: string,
  releaseNotes: string,
  releaseName: string
) {
  return [
    `Populate the pull-request Markdown template for release '${releaseName}'.`,
    'Determine the intended release-notes location from its headings, instructions, comments, and placeholder text.',
    'Replace only the placeholder or empty content intended for release notes with the supplied release notes.',
    'Preserve the complete template structure and all unrelated wording, headings, links, comments, and checklist states exactly.',
    'Do not mark checkboxes, answer unrelated questions, add facts, summarize the supplied notes, or wrap the result in a code fence.',
    'Return the complete populated Markdown template and nothing else.',
    '',
    '<pull_request_template>',
    template,
    '</pull_request_template>',
    '',
    '<generated_release_notes>',
    releaseNotes,
    '</generated_release_notes>',
  ].join('\n');
}

export function buildTemplateReviewPrompt(
  template: string,
  releaseNotes: string,
  populatedTemplate: string,
  releaseName: string
) {
  return [
    `Review the populated pull-request template for release '${releaseName}'.`,
    'Correct it only if needed so the generated release notes appear in the most appropriate release-note section.',
    'The original template is authoritative. Preserve all of its unrelated headings, wording, links, comments, and unchecked checklist states exactly.',
    'Remove the release-note placeholder, but do not alter unrelated placeholders or answer unrelated questions.',
    'Return the complete corrected Markdown template and nothing else.',
    '',
    '<original_template>',
    template,
    '</original_template>',
    '',
    '<generated_release_notes>',
    releaseNotes,
    '</generated_release_notes>',
    '',
    '<populated_template_to_review>',
    populatedTemplate,
    '</populated_template_to_review>',
  ].join('\n');
}

export function assertTemplateScaffoldingPreserved(template: string, result: string) {
  const protectedLines = template
    .split('\r\n')
    .join('\n')
    .split('\n')
    .filter((line) => /^(#{1,6})\s+\S/.test(line) || /^\s*- \[[ xX]\]\s+/.test(line));
  const comments = template.match(/<!--[\s\S]*?-->/g) || [];
  const missing = [...protectedLines, ...comments].filter((part) => !result.includes(part));
  if (missing.length > 0) {
    throw new Error(
      `The model did not preserve required template structure: ${missing
        .map((part) => JSON.stringify(part))
        .join(', ')}`
    );
  }
}
