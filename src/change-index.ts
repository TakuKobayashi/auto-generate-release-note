export type TextPatch = { filePath: string; content: string };

export type ChangeIndexEntry = {
  id: string;
  filePath: string;
  header: string;
  additions: number;
  deletions: number;
  signals: string[];
  evidence: string[];
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function matches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].map((match) => match[1] || match[0]);
}

function extractSignals(lines: string[], filePath: string) {
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

  const signals = unique([
    ...declarations.map((value) => `declaration:${value}`),
    ...exports.map((value) => `public:${value}`),
    ...keys.map((value) => `key:${value}`),
    ...flags.map((value) => `option:${value}`),
    ...testNames.map((value) => `test:${value}`),
    ...routes.map((value) => `route:${value}`),
    ...imports.map((value) => `module:${value}`),
  ]);
  if (/(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:spec|test)\.[^/]+$/i.test(filePath)) {
    return signals.filter((signal) => /^(?:test|option|route):/.test(signal));
  }
  return signals;
}

function extractSemanticEvidence(lines: string[], filePath: string) {
  const changed = lines
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line))
    .map((line) => ({ operation: line[0], source: line.slice(1) }));
  const groups = new Map<string, string[]>();
  const isDocumentation = /\.(?:md|mdx)$/i.test(filePath);
  const isTest = /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:spec|test)\.[^/]+$/i.test(filePath);
  const add = (label: string, value: string) => {
    const normalized = value.trim().replace(/\s+/g, ' ').replace(/[;,]$/, '');
    if (!normalized) return;
    groups.set(label, unique([...(groups.get(label) || []), normalized]));
  };

  for (const { operation, source } of changed) {
    const value = source.trim().replace(/\s+/g, ' ');
    if (!value || /^[{}()[\],;]+$/.test(value)) continue;
    const kind = operation === '+' ? 'added' : 'removed';
    const declaration = value.match(
      /\b(?:class|interface|type|enum|function|def|fn|func|struct|trait|const|let|var)\s+([A-Za-z_$][\w$]*)/
    );
    const assignment = value.match(/^([A-Za-z_$][\w$.-]*)\s*[:=]/);
    const call = value.match(/\b([A-Za-z_$][\w$.]*)\s*\(/);
    const heading = value.match(/^#{1,6}\s+(.+)/);

    if (declaration && /\b(?:export|public)\b/.test(value)) {
      add(`${kind} public declarations`, declaration[1]);
    }
    if (assignment && /^(?:module\.exports|exports\.|public\b)/.test(value)) {
      add(`${kind} public assigned values`, assignment[1]);
    }
    if (/^(?:return|throw|raise)\b/.test(value)) add(`${kind} outcomes`, value.split(/[ (]/)[0]);
    if (/^(?:if|else if|switch|case|when|while|for)\b/.test(value)) {
      add(`${kind} control flow`, value.split(/[ (]/)[0]);
    }
    if (heading) add(`${kind} documentation sections`, heading[1]);
    if (call && !declaration && !isTest && !/^(?:if|for|while|switch|catch)$/.test(call[1])) {
      add(`${kind} calls`, call[1].replace(/\d+$/, '#'));
    }

    for (const match of value.matchAll(/["'`]([^"'`\n]{3,})["'`]/g)) {
      const literal = match[1];
      if (
        !isTest &&
        (/^(?:--|\/|https?:\/\/|INPUT_|GITHUB_)/.test(literal) ||
          (/(?:\bthrow\b|\braise\b|\bnew\s+Error\s*\(|\bError\s*\()/i.test(value) &&
            /\b(?:error|failed|cannot|must|required|deprecated|unsupported|invalid)\b/i.test(
              literal
            )))
      ) {
        add(`${kind} externally meaningful literals`, literal);
      }
    }
    if (isDocumentation) {
      for (const inlineCode of value.matchAll(/`([^`]+)`/g)) {
        add(`${kind} documented identifiers`, inlineCode[1]);
      }
    }
  }

  return [...groups].map(([label, values]) => `${label}: ${values.join(', ')}`);
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
        signals: extractSignals(hunk.lines, patch.filePath),
        evidence: extractSemanticEvidence(hunk.lines, patch.filePath),
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
      evidence: unique(metadataChanges.split('\n').map((line) => line.trim())),
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
    `signals: ${formatSignals(entry.signals)}`,
    `semantic changes: ${entry.evidence.join(' ; ') || 'implementation changed within the named scope'}`,
  ].join('\n');
}

function formatSignals(signals: string[]) {
  const groups = new Map<string, string[]>();
  for (const signal of signals) {
    const separator = signal.indexOf(':');
    const kind = separator < 0 ? 'other' : signal.slice(0, separator);
    const value = separator < 0 ? signal : signal.slice(separator + 1);
    groups.set(kind, unique([...(groups.get(kind) || []), value]));
  }
  return (
    [...groups].map(([kind, values]) => `${kind}: ${values.join(', ')}`).join(' ; ') ||
    'no named symbol or configuration signal'
  );
}

export function formatChangeIndex(entries: ChangeIndexEntry[]) {
  const files = new Map<string, ChangeIndexEntry[]>();
  for (const entry of entries) {
    files.set(entry.filePath, [...(files.get(entry.filePath) || []), entry]);
  }
  return (
    [...files]
      .map(([filePath, fileEntries]) => {
        const hunks = fileEntries
          .map(
            ({ id, additions, deletions, header }) => `${id} +${additions}/-${deletions} ${header}`
          )
          .join(' | ');
        const signals = unique(fileEntries.flatMap(({ signals }) => signals));
        const evidence = unique(fileEntries.flatMap(({ evidence }) => evidence));
        return [
          `FILE: ${filePath}`,
          `hunks: ${hunks}`,
          `signals: ${formatSignals(signals)}`,
          `semantic changes: ${evidence.join(' ; ') || 'implementation changed within the named scopes'}`,
        ].join('\n');
      })
      .join('\n\n') || 'No diff hunks are available.'
  );
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
