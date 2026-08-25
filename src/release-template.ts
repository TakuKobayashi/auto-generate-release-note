export function buildTemplateReleaseNotesInstruction(template: string, releaseName: string) {
  return [
    `Write the final release notes directly into this Markdown template for release '${releaseName}'.`,
    'Determine the intended release-notes location from its headings, instructions, comments, and placeholder text.',
    'Replace only the placeholder or empty content intended for release notes.',
    'Preserve the complete template structure and all unrelated wording, headings, links, comments, and checklist states exactly.',
    'Do not mark checkboxes, answer unrelated questions, add unsupported facts, or wrap the result in a code fence.',
    'Return the complete populated Markdown template and nothing else.',
    '',
    '<pull_request_template>',
    template,
    '</pull_request_template>',
  ].join('\n');
}
