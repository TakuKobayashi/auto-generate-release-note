export type CliOptions = Record<string, any>;

const booleanOptions = new Set(['dry-run', 'fail-on-llm-error', 'bilingual']);
const valueOptions = new Set([
  'tag',
  'release-name',
  'model',
  'language',
  'ollama-host',
  'output-file',
  'template-file',
  'inference-timeout-seconds',
  'github-token',
]);

export const helpText = `Usage: node dist/index.js [options]

Options:
  --dry-run                 Generate notes without changing a GitHub Release
  --tag <tag>               Target tag (defaults to HEAD in dry-run mode)
  --release-name <name>     Display name for notes (defaults to --tag)
  --language <language>     Primary release-note language
  --bilingual               Include English before the selected non-English language
  --model <model>           Ollama model name
  --ollama-host <url>       Ollama API base URL
  --output-file <path>      Write generated Markdown to this path
  --template-file <path>    Populate the release-note section of a Markdown template
  --inference-timeout-seconds <seconds>
                            Stop when an Ollama response stream becomes inactive
  --fail-on-llm-error       Disable deterministic fallback notes
  --github-token <token>    GitHub token (prefer INPUT_GITHUB_TOKEN for secrecy)
  -h, --help                Show this help`;

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);

    const [rawName, inlineValue] = argument.slice(2).split('=', 2);
    if (booleanOptions.has(rawName)) {
      if (inlineValue !== undefined && inlineValue !== 'true' && inlineValue !== 'false') {
        throw new Error(`Option --${rawName} must be true or false`);
      }
      options[rawName] = inlineValue === undefined ? true : inlineValue === 'true';
      continue;
    }
    if (!valueOptions.has(rawName)) {
      throw new Error(`Unknown option: --${rawName}. Use --help for usage.`);
    }

    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Option --${rawName} requires a value`);
    options[rawName] = value;
  }

  return options;
}
