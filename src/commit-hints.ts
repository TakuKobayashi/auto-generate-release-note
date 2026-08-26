import type { TextPatch } from './change-index.js';

export type CommitCandidate = { hash: string; display: string };
export type TargetLineRange = { start: number; end: number };

export function parseCommitCandidates(log: string) {
  return log
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf('\t');
      return separator < 0
        ? { hash: line, display: line }
        : { hash: line.slice(0, separator), display: line.slice(separator + 1) };
    });
}

export function extractAddedLineRanges(patch: string) {
  const addedLines: number[] = [];
  let targetLine: number | undefined;

  for (const line of patch.split('\n')) {
    const header = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (header) {
      targetLine = Number(header[1]);
      continue;
    }
    if (targetLine === undefined || line.startsWith('\\')) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines.push(targetLine);
      targetLine += 1;
    } else if (!line.startsWith('-')) {
      targetLine += 1;
    }
  }

  const ranges: TargetLineRange[] = [];
  for (const line of addedLines) {
    const previous = ranges.at(-1);
    if (previous && previous.end + 1 === line) previous.end = line;
    else ranges.push({ start: line, end: line });
  }
  return ranges;
}

export function buildSurvivingCommitHints(options: {
  commits: CommitCandidate[];
  patches: TextPatch[];
  metadataFilePaths: string[];
  blameHashes: (filePath: string, ranges: TargetLineRange[]) => string[];
  latestHash: (filePath: string) => string;
}) {
  const available = new Set(options.commits.map(({ hash }) => hash));
  const selected = new Set<string>();
  const addHash = (hash: string) => {
    const normalized = hash.replace(/^\^/, '');
    if (available.has(normalized)) selected.add(normalized);
  };

  for (const patch of options.patches) {
    const ranges = extractAddedLineRanges(patch.content);
    if (ranges.length === 0) {
      addHash(options.latestHash(patch.filePath));
      continue;
    }
    for (const hash of options.blameHashes(patch.filePath, ranges)) addHash(hash);
  }
  for (const filePath of options.metadataFilePaths) addHash(options.latestHash(filePath));

  return options.commits.filter(({ hash }) => selected.has(hash));
}
