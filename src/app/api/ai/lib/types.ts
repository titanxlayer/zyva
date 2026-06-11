export interface VectorDbEntry {
  path: string;
  content: string;
  embeddings: number[];
  timestamp: string;
}

export interface VectorSearchResult {
  path: string;
  content: string;
  similarity: number;
}

export interface ChatRequestBody {
  message: string;
  apiKey?: string;
  ogApiKey?: string;
  walletConnected?: boolean;
  model?: string;
  modelNetwork?: string;
  useTee?: boolean;
  activeFile?: string;
  activeFileContent?: string;
  projectName?: string;
  projectPath?: string;
  fileTreeStr?: string;
  history?: Array<{ role: string; content: string }>;
}

export interface TeeAttestation {
  nodeId: string;
  enclave: string;
  timestamp: number;
  signature: string;
}
