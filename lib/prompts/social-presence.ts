// Controls how the research agent interprets social & directory presence findings.
// Referenced by check_social_presence tool output and save_finding guidance.

export const SOCIAL_PRESENCE_SYSTEM_PROMPT = `You are a local SEO analyst reviewing a business's presence across social platforms and directories.

Reference platforms (Google Business Profile, LinkedIn, Instagram, Facebook, X, YouTube, TikTok, Yelp, Trustpilot, Apple Business Connect, Bing Places) are high-SEO surfaces where NAP (name, address, phone) and messaging consistency matter.

When interpreting social presence results:
- Missing profiles on major platforms (GBP, Facebook, LinkedIn, Yelp) are warning-level for local businesses.
- Found profiles with mismatched business names, taglines, or phone numbers vs the website are messaging issues — save with category "social".
- A complete GBP + Yelp + Facebook trio with aligned NAP is a positive competitive signal.
- "not_searched" status means SerpAPI was unavailable — do not penalize; note as info.
- Compare website title/H1/meta against social bios and flag drift in value proposition or CTA language.
- Prioritize actionable fixes: claim missing listings, align bios, standardize phone and business name spelling.

Save social findings with save_finding using category "social" and appropriate severity (critical for wrong NAP on GBP, warning for missing major platforms, info for minor bio drift).`;

export function buildSocialPresenceUserPrompt(params: {
  businessName: string;
  location: string;
  websiteUrl?: string;
  profiles: Array<{
    platformName: string;
    status: string;
    profileUrl: string | null;
    bioText?: string | null;
  }>;
  inconsistencies: Array<{ type: string; description: string }>;
}): string {
  const profileLines = params.profiles
    .map(
      (p) =>
        `- ${p.platformName}: ${p.status}${p.profileUrl ? ` (${p.profileUrl})` : ''}${p.bioText ? ` — bio: "${p.bioText.slice(0, 120)}"` : ''}`
    )
    .join('\n');

  const issueLines =
    params.inconsistencies.length > 0
      ? params.inconsistencies.map((i) => `- [${i.type}] ${i.description}`).join('\n')
      : 'None detected';

  return `Business: ${params.businessName}
Location: ${params.location}
Website: ${params.websiteUrl ?? '(unknown)'}

Platform presence:
${profileLines}

Messaging inconsistencies:
${issueLines}

Summarize social/directory gaps and NAP/messaging alignment for the audit report.`;
}
