export type TextPatch = { filePath: string; content: string };

export type ChangeIndexEntry = {
  id: string;
  filePath: string;
  header: string;
  additions: number;
  deletions: number;
  signals: string[];
  content: string;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function matches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].map((match) => match[1] || match[0]);
}

function extractSignals(lines: string[]) {
  const changed = lines
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line))
    .map((line) => line.slice(1));
  const source = changed.join('\n');
  const declarations = matches(
    source,
    /\b(?:class|interface|type|enum|function|def|fn|func|struct|trait|const|let|var)\s+([A-Za-z_$][\w$]*)/g
  );
  const exports = matches(
    source,
    /\b(?:export|public)\s+(?:default\s+)?(?:async\s+)?(?:class|interface|type|enum|function|const|let|var)?\s*([A-Za-z_$][\w$]*)/g
  );
  const keys = changed.flatMap((line) => {
    const match = line.match(/^\s*["']?([A-Za-z_$][\w$.-]*)["']?\s*[:=]/);
    return match ? [match[1]] : [];
  });
  const flags = matches(source, /(?:^|[^\w])(--[a-z0-9][a-z0-9-]*)/gi);
  const testNames = matches(source, /\b(?:describe|it|test)\s*\(\s*["'`]([^"'`]+)["'`]/g);
  const routes = matches(source, /["'`]((?:\/api\/|\/)[A-Za-z0-9_./:{}-]+)["'`]/g);
  const imports = changed
    .filter((line) => /^\s*(?:import|export\s+.+\s+from|from|use|#include)\b/.test(line))
    .map((line) => line.trim());

  return unique([
    ...declarations.map((value) => `declaration:${value}`),
    ...exports.map((value) => `public:${value}`),
    ...keys.map((value) => `key:${value}`),
    ...flags.map((value) => `option:${value}`),
    ...testNames.map((value) => `test:${value}`),
    ...routes.map((value) => `route:${value}`),
    ...imports.map((value) => `module:${value}`),
  ]);
}

function patchHunks(patch: TextPatch) {
  const lines = patch.content.split('\n');
  const hunks: Array<{ header: string; lines: string[] }> = [];
  let current: { header: string; lines: string[] } | undefined;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (current) hunks.push(current);
      current = { header: line, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) hunks.push(current);
  if (hunks.length === 0) {
    hunks.push({ header: 'file-level change', lines });
  }
  return hunks;
}

export function buildChangeIndex(patches: TextPatch[], metadataChanges: string) {
  const entries: ChangeIndexEntry[] = [];
  for (const patch of patches) {
    for (const hunk of patchHunks(patch)) {
      const additions = hunk.lines.filter(
        (line) => line.startsWith('+') && !line.startsWith('+++')
      ).length;
      const deletions = hunk.lines.filter(
        (line) => line.startsWith('-') && !line.startsWith('---')
      ).length;
      entries.push({
        id: '',
        filePath: patch.filePath,
        header: hunk.header,
        additions,
        deletions,
        signals: extractSignals(hunk.lines),
        content: `FILE: ${patch.filePath}\n${hunk.lines.join('\n')}`,
      });
    }
  }
  if (metadataChanges) {
    entries.push({
      id: '',
      filePath: '<metadata-only files>',
      header: 'generated, lock, binary, or serialized changes',
      additions: 0,
      deletions: 0,
      signals: unique(metadataChanges.split('\n').map((line) => `metadata:${line.trim()}`)),
      content: `METADATA-ONLY CHANGES:\n${metadataChanges}`,
    });
  }
  for (const [index, entry] of entries.entries()) {
    entry.id = `H${String(index + 1).padStart(4, '0')}`;
  }
  return entries;
}

export function formatChangeIndexEntry(entry: ChangeIndexEntry) {
  return [
    `${entry.id} | ${entry.filePath} | +${entry.additions}/-${entry.deletions} | ${entry.header}`,
    `signals: ${entry.signals.join(' ; ') || 'none; inspect this hunk if its behavior matters'}`,
    `full-diff-chars: ${entry.content.length}`,
  ].join('\n');
}

export function formatChangeIndex(entries: ChangeIndexEntry[]) {
  return entries.map(formatChangeIndexEntry).join('\n\n') || 'No diff hunks are available.';
}

export function buildContextDigest(files: Array<{ path: string; content: string }>) {
  return (
    files
      .map(({ path, content }) => {
        if (/\.md$/i.test(path)) {
          const lines = content.split(/\r?\n/);
          const headings = lines.filter((line) => /^#{1,6}\s+\S/.test(line));
          const firstParagraph = lines
            .join('\n')
            .split(/\n\s*\n/)
            .map((part) => part.trim())
            .find((part) => part && !part.startsWith('#'));
          return `CONTEXT: ${path}\n${[firstParagraph, ...headings].filter(Boolean).join('\n')}`;
        }
        if (/\.json$/i.test(path)) {
          try {
            const value = JSON.parse(content);
            const digest = {
              name: value.name,
              description: value.description,
              type: value.type,
              workspaces: value.workspaces,
              engines: value.engines,
              dependencies: Object.keys(value.dependencies || {}),
            };
            return `CONTEXT: ${path}\n${JSON.stringify(digest)}`;
          } catch {}
        }
        const facts = content
          .split(/\r?\n/)
          .filter((line) =>
            /^\s*(?:name|description|module|package|group|artifact|version|workspace)\b/i.test(line)
          );
        return `CONTEXT: ${path}\n${facts.join('\n')}`;
      })
      .filter((value) => !value.endsWith('\n'))
      .join('\n\n') || 'No unchanged project context was needed.'
  );
}

export function parseEvidenceSelection(response: string, availableIds: string[]) {
  const cleaned = response
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.selected_ids)) {
    throw new Error('Evidence selection did not contain selected_ids');
  }
  const available = new Set(availableIds);
  return unique(parsed.selected_ids.filter((id: unknown) => typeof id === 'string')).filter((id) =>
    available.has(id)
  );
}
