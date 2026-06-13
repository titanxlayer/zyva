import fs from 'fs';
import path from 'path';
import { getConfig } from '../config';
import { DashScopeProvider } from '../providers/dashscope';

/**
 * Design-template library (sourced from voltagent/awesome-design-md, MIT).
 *
 * Instead of asking the LLM to write a full DESIGN.md from scratch (expensive),
 * we embed 74 curated design systems offline and retrieve the closest match to
 * the user's intent. If nothing is close enough, the caller generates from scratch.
 */

export interface DesignManifestEntry {
  slug: string;
  name: string;
  description: string;
}

export interface DesignMatch {
  slug: string;
  name: string;
  score: number;
  designMd: string;
}

const LIB_DIR = path.join(process.cwd(), 'templates', 'design-library');

let manifestCache: DesignManifestEntry[] | null = null;
let embeddingsCache: { slug: string; vector: number[] }[] | null = null;

function loadManifest(): DesignManifestEntry[] {
  if (manifestCache) return manifestCache;
  try {
    manifestCache = JSON.parse(fs.readFileSync(path.join(LIB_DIR, 'manifest.json'), 'utf-8'));
  } catch {
    manifestCache = [];
  }
  return manifestCache!;
}

function loadEmbeddings(): { slug: string; vector: number[] }[] {
  if (embeddingsCache) return embeddingsCache;
  try {
    embeddingsCache = JSON.parse(fs.readFileSync(path.join(LIB_DIR, 'embeddings.json'), 'utf-8'));
  } catch {
    embeddingsCache = [];
  }
  return embeddingsCache!;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Read a template's full DESIGN.md by slug. */
export function loadDesignTemplate(slug: string): string | null {
  try {
    return fs.readFileSync(path.join(LIB_DIR, `${slug}.md`), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Find the closest design template to the user's intent via embeddings.
 * Returns the best match only if its cosine score ≥ `threshold`, else null
 * (signal to the caller that it should generate a design from scratch).
 */
export async function findDesignTemplate(
  query: string,
  threshold = 0.42,
): Promise<DesignMatch | null> {
  const q = (query || '').trim();
  if (!q) return null;

  const embeddings = loadEmbeddings();
  const manifest = loadManifest();
  if (!embeddings.length) return null;

  const cfg = getConfig();
  if (!cfg.dashscope.apiKey) return null; // no embedding backend → caller generates

  let queryVec: number[];
  try {
    const provider = new DashScopeProvider(cfg.dashscope.apiKey, cfg.dashscope.base);
    [queryVec] = await provider.embed({ model: cfg.embed.model, input: [q], dimensions: cfg.embed.dims });
  } catch {
    return null;
  }
  if (!queryVec?.length) return null;

  let best: { slug: string; score: number } | null = null;
  for (const e of embeddings) {
    const score = cosine(queryVec, e.vector);
    if (!best || score > best.score) best = { slug: e.slug, score };
  }
  if (!best || best.score < threshold) return null;

  const designMd = loadDesignTemplate(best.slug);
  if (!designMd) return null;
  const meta = manifest.find(m => m.slug === best!.slug);
  return { slug: best.slug, name: meta?.name || best.slug, score: best.score, designMd };
}

/** List all available template slugs (for diagnostics / UI). */
export function listDesignTemplates(): DesignManifestEntry[] {
  return loadManifest();
}
