/**
 * Code-aware chunker.
 *
 * This is a pragmatic, dependency-free splitter that breaks a file into
 * semantically meaningful chunks (functions/classes/exports/blocks) with line
 * ranges. It is structured so a tree-sitter backed chunker can replace
 * `chunkFile` later without touching callers.
 */

export interface CodeChunk {
  path: string;
  content: string;
  startLine: number;
  endLine: number;
}

const MAX_CHUNK_LINES = 80;
const MIN_CHUNK_CHARS = 24;

// Lines that usually start a new semantic unit in JS/TS/Py/Rust.
const BOUNDARY = /^\s*(export\s+)?(async\s+)?(function|class|interface|type|enum|const|let|var|def|fn|impl|struct|pub\s+fn|public|private|protected)\b/;

export function chunkFile(path: string, content: string): CodeChunk[] {
  const lines = content.split('\n');
  if (lines.length <= MAX_CHUNK_LINES) {
    const trimmed = content.trim();
    return trimmed.length >= MIN_CHUNK_CHARS
      ? [{ path, content: trimmed, startLine: 1, endLine: lines.length }]
      : [];
  }

  const chunks: CodeChunk[] = [];
  let start = 0;

  const flush = (end: number) => {
    const slice = lines.slice(start, end).join('\n').trim();
    if (slice.length >= MIN_CHUNK_CHARS) {
      chunks.push({ path, content: slice, startLine: start + 1, endLine: end });
    }
    start = end;
  };

  for (let i = 1; i < lines.length; i++) {
    const isBoundary = BOUNDARY.test(lines[i]);
    const tooBig = i - start >= MAX_CHUNK_LINES;
    if ((isBoundary && i - start > 4) || tooBig) flush(i);
  }
  flush(lines.length);

  return chunks;
}
