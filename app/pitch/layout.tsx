import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SynapseCRO — Pitch deck',
  description: 'Demo pitch deck for SynapseCRO: automated SEO audits, fix PRs, and no-code fix packs.',
};

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
