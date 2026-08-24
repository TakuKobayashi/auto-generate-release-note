import { extname } from 'node:path';

export type TextPatch = { filePath: string; content: string };
export type AnalysisTask = { group: string; files: string[]; evidence: string };

const metadataOnlyNames = new Set([
  'package-lock.json',
  'packages-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'cargo.lock',
  'composer.lock',
  'gemfile.lock',
  'poetry.lock',
]);
const metadataOnlyExtensions = new Set(['.asset', '.meta', '.prefab', '.unity', '.uss', '.uxml']);
const projectContextNames = new Set([
  'README.md',
  'README-ja.md',
  'package.json',
  'pnpm-workspace.yaml',
  'Cargo.toml',
  'pyproject.toml',
  'go.mod',
  'pom.xml',
  'settings.gradle',
  'settings.gradle.kts',
  'build.gradle',
  'build.gradle.kts',
  'ProjectSettings/ProjectVersion.txt',
  'Packages/manifest.json',
]);

export function relatedGroup(filePath: string) {
  const segments = filePath.replaceAll('\\', '/').split('/');
  if (segments[0] === 'packages' && segments[1]) return `packages/${segments[1]}`;
  if (segments[0] === 'Assets' && segments[1]) return `Assets/${segments[1]}`;
  if (segments[0]?.startsWith('.')) return segments[0];
  return segments.length === 1 ? 'repository root' : segments[0];
}

export function shouldAnalyzeAsMetadata(filePath: string) {
  const normalized = filePath.replaceAll('\\', '/');
  const fileName = normalized.split('/').at(-1)?.toLowerCase() || '';
  return (
    metadataOnlyNames.has(fileName) ||
    metadataOnlyExtensions.has(extname(fileName).toLowerCase()) ||
    /(^|\/)(dist|build|generated|vendor)(\/|$)/i.test(normalized) ||
    /\.(min\.(js|css)|snap)$/i.test(normalized)
  );
}

export function selectProjectContextFiles(paths: string[]) {
  return paths.filter((filePath) => {
    const normalized = filePath.replaceAll('\\', '/');
    const fileName = normalized.split('/').at(-1) || '';
    return (
      projectContextNames.has(normalized) ||
      projectContextNames.has(fileName) ||
      /(^|\/)README(?:-[^/]+)?\.md$/i.test(normalized)
    );
  });
}

export function createAnalysisTasks(patches: TextPatch[]): AnalysisTask[] {
  const groups = new Map<string, TextPatch[]>();
  for (const patch of patches) {
    const group = relatedGroup(patch.filePath);
    groups.set(group, [...(groups.get(group) || []), patch]);
  }
  return [...groups].map(([group, groupPatches]) => ({
    group,
    files: groupPatches.map(({ filePath }) => filePath),
    evidence: groupPatches
      .map(({ filePath, content }) => `FILE: ${filePath}\n${content}`)
      .join('\n\n'),
  }));
}

export function splitEvidence(evidence: string) {
  const lines = evidence.split('\n');
  if (lines.length < 2) {
    const middle = Math.ceil(evidence.length / 2);
    return [evidence.slice(0, middle), evidence.slice(middle)].filter(Boolean);
  }
  const middle = Math.ceil(lines.length / 2);
  return [lines.slice(0, middle).join('\n'), lines.slice(middle).join('\n')].filter(Boolean);
}
