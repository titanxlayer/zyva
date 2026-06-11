/**
 * Central runtime configuration. All secrets and tunables are read from the
 * environment so nothing sensitive lives in source. Server-side only.
 */

export interface ZyvaConfig {
  cerebrasApiKey: string;
  dashscope: { apiKey: string; base: string };
  embed: { model: string; dims: number; backend: 'dashscope' | 'local' | 'gateway' };
  ollama: { base: string; model: string };
  gateway: { url: string; key: string };
  rerankModel: string;
  visionEmbedModel: string;
  vectorStore: 'local' | 'qdrant';
  qdrant: { url: string; apiKey: string };
  langfuse: { publicKey: string; secretKey: string; baseUrl: string };
  exec: { timeoutMs: number; autorunCommands: boolean };
}

export function getConfig(): ZyvaConfig {
  const env = process.env;
  return {
    cerebrasApiKey: env.CEREBRAS_API_KEY || '',
    dashscope: {
      apiKey: env.DASHSCOPE_API_KEY || '',
      base: env.DASHSCOPE_BASE || 'https://dashscope-intl.aliyuncs.com',
    },
    embed: {
      model: env.ZYVA_EMBED_MODEL || 'text-embedding-v4',
      dims: parseInt(env.ZYVA_EMBED_DIMS || '1024', 10),
      backend: (env.ZYVA_EMBED_BACKEND as 'dashscope' | 'local' | 'gateway') || 'dashscope',
    },
    ollama: {
      base: env.OLLAMA_BASE || 'http://localhost:11434',
      model: env.ZYVA_LOCAL_EMBED_MODEL || 'qwen3-embedding:0.6b',
    },
    gateway: {
      url: env.ZYVA_GATEWAY_URL || '',
      key: env.ZYVA_GATEWAY_KEY || '',
    },
    rerankModel: env.ZYVA_RERANK_MODEL || 'qwen3-rerank',
    visionEmbedModel: env.ZYVA_VISION_EMBED_MODEL || 'tongyi-embedding-vision-flash',
    vectorStore: (env.ZYVA_VECTOR_STORE as 'local' | 'qdrant') || 'local',
    qdrant: { url: env.QDRANT_URL || '', apiKey: env.QDRANT_API_KEY || '' },
    langfuse: {
      publicKey: env.LANGFUSE_PUBLIC_KEY || '',
      secretKey: env.LANGFUSE_SECRET_KEY || '',
      baseUrl: env.LANGFUSE_BASEURL || '',
    },
    exec: {
      timeoutMs: parseInt(env.ZYVA_EXEC_TIMEOUT_MS || '15000', 10),
      autorunCommands: (env.ZYVA_AUTORUN_COMMANDS || 'false') === 'true',
    },
  };
}
