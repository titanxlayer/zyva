import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZYVA Docs',
  description: 'Documentation for ZYVA Cloud IDE',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
