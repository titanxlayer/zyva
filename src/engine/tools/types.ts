/**
 * Tool definitions for the ZYVA iterative agent loop.
 * All tools are executed server-side; the model calls them by name with typed args.
 * Security: every tool validates its args and operates only inside the project workspace.
 */

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: string;
  output: string;
  error?: string;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'read_file',
    description: 'Read the full content of a file in the project workspace.',
    parameters: {
      path: { type: 'string', description: 'Path relative to project root, e.g. src/App.tsx', required: true },
    },
  },
  {
    name: 'write_file',
    description: 'Write (create or overwrite) a file with the given content. Snapshots the file before writing for rollback safety.',
    parameters: {
      path:    { type: 'string', description: 'Path relative to project root', required: true },
      content: { type: 'string', description: 'Complete new file content',      required: true },
    },
  },
  {
    name: 'apply_edit',
    description: 'Apply a SEARCH→REPLACE patch to an existing file. Use when only a small part of the file changes.',
    parameters: {
      path:       { type: 'string', description: 'Path relative to project root', required: true },
      search:     { type: 'string', description: 'Exact text to find (must match uniquely)', required: true },
      replacement:{ type: 'string', description: 'Text that replaces the search block', required: true },
    },
  },
  {
    name: 'list_dir',
    description: 'List files and directories at a path in the project workspace.',
    parameters: {
      path: { type: 'string', description: 'Relative path (empty string = project root)', required: false },
    },
  },
  {
    name: 'grep',
    description: 'Search for a regex pattern across all project files. Returns matching lines with file paths and line numbers.',
    parameters: {
      pattern: { type: 'string', description: 'Regex pattern to search for', required: true },
      glob:    { type: 'string', description: 'Optional glob to restrict files, e.g. **/*.ts', required: false },
    },
  },
  {
    name: 'run_command',
    description: 'Run an allowed shell command inside the project directory. Only allow-listed commands (npm run …, tsc, eslint, vitest, cargo …). Returns stdout + stderr.',
    parameters: {
      command: { type: 'string', description: 'Shell command to run, e.g. npm run build', required: true },
    },
  },
  {
    name: 'read_terminal',
    description: 'Read recent terminal output (last N lines) from the in-browser terminal.',
    parameters: {
      lines: { type: 'number', description: 'Number of recent lines to return (default 50)', required: false },
    },
  },
  {
    name: 'db_query',
    description: 'Run a SQL query against the project\'s persistent SQLite database. Use for reading or writing application data.',
    parameters: {
      sql:    { type: 'string', description: 'SQL statement to execute', required: true },
      params: { type: 'array',  description: 'Optional bind params (ordered ?-style)', required: false },
    },
  },
];

/** Build the tool schema block to inject into the system prompt. */
export function buildToolSystemBlock(): string {
  const lines = [
    '## TOOLS',
    'You have access to the following tools. To call a tool, emit a JSON block on its own line:',
    '```json',
    '{"tool":"<name>","id":"<unique_call_id>","args":{...}}',
    '```',
    'After calling a tool, wait for the result before continuing. You may call multiple tools in sequence.',
    'Do NOT emit [ZYVA_FILE] or [ZYVA_EDIT] tags — use write_file / apply_edit tools instead.',
    '',
    ...TOOL_DEFS.map((t) => {
      const params = Object.entries(t.parameters)
        .map(([k, v]) => `  ${k}${v.required ? ' (required)' : ''}: ${v.type} — ${v.description}`)
        .join('\n');
      return `### ${t.name}\n${t.description}\nParameters:\n${params}`;
    }),
    '',
    'When the task is fully complete, emit:',
    '{"done":true,"summary":"<one-sentence summary of what was done>"}',
  ];
  return lines.join('\n');
}
