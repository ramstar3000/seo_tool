import Link from 'next/link';
import { PageContainer } from '@/components/ui/PageContainer';

const footerLinks = [
  { href: '/leads', label: 'Leads' },
  { href: '/research', label: 'Research' },
  { href: '/seo-guide', label: 'SEO guide' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-background">
      <PageContainer className="py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
        <p>© {new Date().getFullYear()} SynapseCRO</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {footerLinks.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-zinc-300 transition-colors">
              {label}
            </Link>
          ))}
        </nav>
      </PageContainer>
    </footer>
  );
}
