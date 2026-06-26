'use client';

import { Fragment, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { isAdminEmail } from '@/lib/auth/admin-email';
import { PageContainer, SurfaceCard, formInputClass } from '@/components/ui/PageContainer';

interface Lead {
  name: string;
  category: string;
  email: string;
  phone: string;
  website: string | null;
  source: 'osm-tag' | 'website';
  mxValid: boolean;
  seoScore: number;
  seoIssues: string[];
  draft: { subject: string; body: string };
}

const PRESETS: { label: string; lat: number; lon: number; place: string }[] = [
  { label: "King's Cross", lat: 51.5308, lon: -0.1238, place: "King's Cross" },
  { label: 'Shoreditch', lat: 51.5265, lon: -0.0789, place: 'Shoreditch' },
  { label: 'Soho', lat: 51.5137, lon: -0.1337, place: 'Soho' },
  { label: 'Camden', lat: 51.539, lon: -0.1426, place: 'Camden' },
];

export const metadata = {
  title: 'Lead Finder — SynapseCRO Admin',
  description: 'Admin panel for SynapseCRO to find local business leads, verify emails, and draft personalized outreach.',
};

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const admin = isAdminEmail(user?.email);

  const [lat, setLat] = useState(51.5308);
  const [lon, setLon] = useState(-0.1238);
  const [place, setPlace] = useState("King's Cross");
  const [radius, setRadius] = useState(700);
  const [target, setTarget] = useState(30);
  const [sender, setSender] = useState('');
  const [tool, setTool] = useState('');
  const [toolUrl, setToolUrl] = useState('');
  const [calendar, setCalendar] = useState('');

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [openDraft, setOpenDraft] = useState<number | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setLeads([]);
    setOpenDraft(null);
    try {
      const res = await fetch('/api/admin/find-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lon,
          radius,
          target,
          place: place || undefined,
          sender: sender || undefined,
          tool: tool || undefined,
          url: toolUrl || undefined,
          calendar: calendar || undefined,
        }),
      });
      const data = (await res.json()) as { leads?: Lead[]; error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setLeads(data.leads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRunning(false);
    }
  };

  const csv = useMemo(() => {
    if (!leads.length) return '';
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'name,category,email,phone,website,source,mx_valid,seo_score,seo_issues';
    const rows = leads.map((l) =>
      [l.name, l.category, l.email, l.phone, l.website || '', l.source, l.mxValid ? 'yes' : 'no', l.seoScore, l.seoIssues.join('; ')]
        .map(esc)
        .join(',')
    );
    return [header, ...rows].join('\n');
  }, [leads]);

  const downloadCsv = () => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${place || 'export'}.csv`.replace(/\s+/g, '-').toLowerCase();
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setLat(p.lat);
    setLon(p.lon);
    setPlace(p.place);
  };

  if (isLoading) {
    return (
      <main className="flex-1">
        <PageContainer className="py-14">
          <p className="text-zinc-500">Loading…</p>
        </PageContainer>
      </main>
    );
  }

  if (!admin) {
    return (
      <main className="flex-1">
        <PageContainer narrow className="py-14">
          <SurfaceCard className="p-6">
            <h1 className="text-xl font-semibold text-white">Admin access required</h1>
            <p className="mt-2 text-zinc-400">
              {user
                ? 'Your account is not an admin. Sign in with an @acyclic.dev email to use this page.'
                : 'Please sign in with an @acyclic.dev email to use this page.'}
            </p>
          </SurfaceCard>
        </PageContainer>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <PageContainer wide className="py-10 sm:py-14 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Lead finder</h1>
          <p className="mt-2 text-zinc-400">
            Find local boutique businesses near a location, verify their email domains, score their SEO, and draft
            personalised cold outreach. Nothing is sent — drafts only.
          </p>
        </div>

        {/* Search form */}
        <SurfaceCard className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className={`min-h-9 px-3 rounded-lg text-sm transition-colors ${
                  place === p.place ? 'bg-teal-600 text-white' : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Latitude">
              <input type="number" step="0.0001" value={lat} onChange={(e) => setLat(parseFloat(e.target.value))} className={formInputClass} />
            </Field>
            <Field label="Longitude">
              <input type="number" step="0.0001" value={lon} onChange={(e) => setLon(parseFloat(e.target.value))} className={formInputClass} />
            </Field>
            <Field label="Radius (m)">
              <input type="number" step="50" value={radius} onChange={(e) => setRadius(parseInt(e.target.value, 10))} className={formInputClass} />
            </Field>
            <Field label="Target leads">
              <input type="number" value={target} onChange={(e) => setTarget(parseInt(e.target.value, 10))} className={formInputClass} />
            </Field>
            <Field label="Area name (for copy)">
              <input value={place} onChange={(e) => setPlace(e.target.value)} className={formInputClass} placeholder="King's Cross" />
            </Field>
            <Field label="Your name">
              <input value={sender} onChange={(e) => setSender(e.target.value)} className={formInputClass} placeholder="Avin" />
            </Field>
            <Field label="Tool name">
              <input value={tool} onChange={(e) => setTool(e.target.value)} className={formInputClass} placeholder="RankRadar" />
            </Field>
            <Field label="Tool URL">
              <input value={toolUrl} onChange={(e) => setToolUrl(e.target.value)} className={formInputClass} placeholder="https://…" />
            </Field>
            <Field label="Booking link (optional)">
              <input value={calendar} onChange={(e) => setCalendar(e.target.value)} className={formInputClass} placeholder="https://cal.com/…" />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={running}
              className="min-h-11 px-5 rounded-xl text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white transition-colors"
            >
              {running ? 'Searching… (up to ~90s)' : 'Find leads'}
            </button>
            {leads.length > 0 && (
              <button
                type="button"
                onClick={downloadCsv}
                className="min-h-11 px-4 rounded-xl text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 transition-colors"
              >
                Download CSV
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </SurfaceCard>

        {/* Results */}
        {leads.length > 0 && (
          <SurfaceCard className="overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] text-sm text-zinc-400">
              {leads.length} leads · ranked worst-SEO first (best prospects)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-white/[0.06]">
                    <th className="px-5 py-2 font-medium">Business</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">SEO</th>
                    <th className="px-3 py-2 font-medium">Issues</th>
                    <th className="px-3 py-2 font-medium">Draft</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l, i) => (
                    <Fragment key={l.email}>
                      <tr className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-5 py-3">
                          <div className="text-white">{l.name}</div>
                          <div className="text-xs text-zinc-500">{l.category}</div>
                        </td>
                        <td className="px-3 py-3 text-zinc-300">{l.email}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex min-w-7 justify-center rounded-md px-2 py-0.5 text-xs font-medium ${
                              l.seoScore >= 5
                                ? 'bg-red-500/15 text-red-300'
                                : l.seoScore >= 3
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-white/[0.06] text-zinc-300'
                            }`}
                          >
                            {l.seoScore}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-zinc-500 max-w-xs">{l.seoIssues.join(', ')}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setOpenDraft(openDraft === i ? null : i)}
                            className="text-teal-400 hover:text-teal-300 text-xs"
                          >
                            {openDraft === i ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {openDraft === i && (
                        <tr className="bg-zinc-950/60">
                          <td colSpan={5} className="px-5 py-4">
                            <div className="text-xs text-zinc-500 mb-1">Subject: {l.draft.subject}</div>
                            <pre className="whitespace-pre-wrap text-sm text-zinc-200 font-sans">{l.draft.body}</pre>
                            <button
                              type="button"
                              onClick={() =>
                                navigator.clipboard.writeText(`Subject: ${l.draft.subject}\n\n${l.draft.body}`)
                              }
                              className="mt-3 min-h-9 px-3 rounded-lg text-xs bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200"
                            >
                              Copy email
                            </button>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        )}
      </PageContainer>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
