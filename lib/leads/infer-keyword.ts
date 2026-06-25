export function inferKeywordFromWebsite(websiteUrl: string, businessName?: string | null): string {
  try {
    const hostname = new URL(websiteUrl).hostname.replace(/^www\./i, '');
    const slug = hostname.split('.')[0];
    if (slug && slug.length > 2 && !['localhost', '127', 'example'].includes(slug)) {
      return slug.replace(/[-_]+/g, ' ').trim().slice(0, 200);
    }
  } catch {
    // fall through
  }

  if (businessName?.trim()) {
    return `${businessName.trim()} local business`.slice(0, 200);
  }

  return 'local business';
}
