'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileCode2, Terminal, FolderPlus, Check, X, Play, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AgentAction, ChatMessage } from '@/store/useIdeStore';
import { Shield } from 'lucide-react';

// ─── Inline Markdown ──────────────────────────────────────────────────────────
export function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**'))
          return <em key={i} className="italic text-zinc-300">{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="font-mono text-[11px] bg-zinc-800 text-[#4ec9b0] px-1.5 py-0.5 rounded">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Markdown Block ───────────────────────────────────────────────────────────
export function MarkdownBlock({ text }: { text: string }) {
  if (!text.trim()) return null;
  const segments = text.split(/(```[\w]*\n[\s\S]*?```)/g);
  return (
    <div className="space-y-2 text-[12px] leading-relaxed text-zinc-300 select-text">
      {segments.map((seg, idx) => {
        const codeMatch = seg.match(/^```([\w]*)\n([\s\S]*)```$/);
        if (codeMatch) {
          return (
            <div key={idx} className="rounded-lg overflow-hidden border border-zinc-700/50">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/80 text-[10px] text-zinc-500 font-mono">
                <span className="text-zinc-400">{codeMatch[1] || 'text'}</span>
              </div>
              <pre className="p-3 bg-[#1a1a1a] text-zinc-300 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {codeMatch[2]}
              </pre>
            </div>
          );
        }
        const lines = seg.split('\n').filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
        return (
          <div key={idx} className="space-y-1.5">
            {lines.map((line, li) => {
              if (!line.trim()) return <div key={li} className="h-1" />;
              if (line.startsWith('### ')) return <h3 key={li} className="text-[13px] font-bold text-white mt-2">{line.slice(4)}</h3>;
              if (line.startsWith('## ')) return <h2 key={li} className="text-[14px] font-bold text-white mt-2">{line.slice(3)}</h2>;
              if (line.startsWith('# ')) return <h1 key={li} className="text-[15px] font-bold text-white mt-2">{line.slice(2)}</h1>;
              if (line.trim() === '---') return <div key={li} className="border-t border-zinc-700/60 my-2" />;
              if (line.match(/^[-*]\s/)) return (
                <div key={li} className="flex items-start space-x-2 pl-1">
                  <span className="text-[#4ec9b0] mt-0.5 shrink-0 text-[10px]">▸</span>
                  <span><InlineMarkdown text={line.slice(2)} /></span>
                </div>
              );
              const numMatch = line.match(/^(\d+)\.\s(.+)/);
              if (numMatch) return (
                <div key={li} className="flex items-start space-x-2 pl-1">
                  <span className="text-zinc-500 shrink-0 font-mono text-[10px] mt-0.5">{numMatch[1]}.</span>
                  <span><InlineMarkdown text={numMatch[2]} /></span>
                </div>
              );
              if (line.startsWith('> ')) return (
                <div key={li} className="border-l-2 border-zinc-600 pl-3 text-zinc-500 italic text-[11px]">
                  <InlineMarkdown text={line.slice(2)} />
                </div>
              );
              return <p key={li}><InlineMarkdown text={line} /></p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────
export function ActionCard({ action, messageId, onApply, onReject }: {
  action: AgentAction;
  messageId: string;
  onApply: () => void;
  onReject: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isProject = action.type === 'create_project';
  const isFile = action.type === 'create_file';
  const isEdit = action.type === 'edit_file';
  const isCmd = action.type === 'run_command';
  const isPending = action.status === 'pending';
  const isApplying = action.status === 'applying';
  const isApplied = action.status === 'applied';
  const isRejected = action.status === 'rejected';
  const isFailed = action.status === 'failed';

  const statusColor = isApplied ? 'border-emerald-500/40 bg-emerald-500/5'
    : isRejected ? 'border-zinc-700/30 opacity-50'
    : isFailed ? 'border-red-500/40 bg-red-500/5'
    : isProject ? 'border-purple-500/40 bg-purple-500/5'
    : isEdit ? 'border-cyan-500/40 bg-cyan-500/5'
    : 'border-[#007acc]/30 bg-[#007acc]/5';

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border ${statusColor} overflow-hidden text-[11px] mt-2`}>
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60">
        <div className="flex items-center space-x-2 min-w-0">
          {isProject ? <FolderPlus className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            : (isFile || isEdit) ? <FileCode2 className="w-3.5 h-3.5 text-[#569cd6] shrink-0" />
            : <Terminal className="w-3.5 h-3.5 text-[#dcdcaa] shrink-0" />}
          <span className="font-mono text-zinc-300 truncate">
            {isProject ? action.projectName : (isFile || isEdit) ? action.path : action.command}
          </span>
          {isProject && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono shrink-0">{action.template || 'react'}</span>}
          {isEdit && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono shrink-0 font-bold">Edit</span>}
          {isFile && <span className="text-zinc-600 shrink-0">{action.content?.split('\n').length || 0} lines</span>}
        </div>
        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
          {isApplied && <span className="text-emerald-400 flex items-center space-x-1"><Check className="w-3 h-3" /><span>{isProject ? 'Created' : (isFile || isEdit) ? 'Applied' : 'Done'}</span></span>}
          {isRejected && <span className="text-zinc-500">Rejected</span>}
          {isFailed && <span className="text-red-400">Failed</span>}
          {isApplying && <Loader2 className="w-3 h-3 text-[#007acc] animate-spin" />}
          {(isFile || isEdit) && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {isPending && (
            <>
              <button onClick={onApply}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-white text-[10px] font-semibold transition-colors cursor-pointer ${isProject ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#007acc] hover:bg-[#005f9e]'}`}>
                {isProject ? <><FolderPlus className="w-2.5 h-2.5" /><span>Create</span></>
                  : (isFile || isEdit) ? <><Check className="w-2.5 h-2.5" /><span>Apply</span></>
                  : <><Play className="w-2.5 h-2.5" /><span>Run</span></>}
              </button>
              <button onClick={onReject} className="p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer" title="Reject">
                <X className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
      {isFile && isExpanded && action.content && (
        <pre className="p-3 bg-[#141414] text-zinc-400 text-[10px] font-mono overflow-x-auto max-h-[200px] whitespace-pre leading-relaxed border-t border-zinc-800 select-text">{action.content}</pre>
      )}
      {isEdit && isExpanded && action.edits && (
        <div className="border-t border-zinc-800 bg-[#141414] p-3 text-[10px] font-mono overflow-x-auto max-h-[200px] whitespace-pre leading-relaxed select-text">
          {action.edits.map((edit, idx) => (
            <div key={idx} className="space-y-0.5">
              {action.edits!.length > 1 && <div className="text-zinc-500 font-bold mb-1 border-b border-zinc-800/80 pb-0.5">Chunk #{idx + 1}</div>}
              {edit.oldString.split('\n').map((line, li) => <div key={`o${li}`} className="bg-red-950/45 text-red-300 px-1 py-0.5 rounded-sm flex"><span className="w-4 select-none opacity-40">-</span><span>{line}</span></div>)}
              {edit.newString.split('\n').map((line, li) => <div key={`n${li}`} className="bg-emerald-950/45 text-emerald-300 px-1 py-0.5 rounded-sm flex"><span className="w-4 select-none opacity-40">+</span><span>{line}</span></div>)}
            </div>
          ))}
        </div>
      )}
      {isProject && isPending && (
        <div className="px-3 py-2 bg-purple-500/5 text-purple-300/70 text-[9px] border-t border-purple-500/20">
          Creates new project folder + {action.template || 'react'} template on disk
        </div>
      )}
      {isCmd && isApplied && action.output && (
        <pre className="p-2.5 bg-[#141414] text-emerald-400 text-[10px] font-mono overflow-x-auto max-h-[120px] whitespace-pre border-t border-zinc-800">{action.output.trim()}</pre>
      )}
      {isFailed && action.output && (
        <div className="px-3 py-2 bg-red-900/20 text-red-400 text-[10px] border-t border-red-500/20">{action.output}</div>
      )}
    </motion.div>
  );
}

// ─── TEE Badge ────────────────────────────────────────────────────────────────
export function TeeBadge({ tee }: { tee: NonNullable<ChatMessage['teeAttestation']> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)}
        className="flex items-center space-x-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono hover:bg-emerald-500/15 transition-colors cursor-pointer">
        <Shield className="w-2.5 h-2.5" />
        <span>{tee.label || 'TEE Runtime Connected'}</span>
        {open ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
      </button>
      {open && (
        <div className="mt-1.5 p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[9px] font-mono text-zinc-500 space-y-0.5">
          <div><span className="text-zinc-600">Status:</span> {tee.status}</div>
          <div><span className="text-zinc-600">Isolated:</span> {tee.isolated ? 'yes' : 'no'}</div>
          <div>
            <span className="text-zinc-600">Remote attestation:</span>{' '}
            {tee.verified
              ? <span className="text-emerald-400">verified</span>
              : <span className="text-amber-400">not verified (no quote yet)</span>}
          </div>
        </div>
      )}
    </div>
  );
}
