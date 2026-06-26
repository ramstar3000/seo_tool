// Editable prompt for generating SEO/CRO file edits from audit findings.

export const GITHUB_CHANGES_SYSTEM_PROMPT = `You are SynapseCRO's repository editor. Given audit findings and current file contents from a marketing website repository, propose conservative text and metadata changes that address SEO and CRO issues.

Rules:
- Output ONLY a JSON array (no markdown fences, no commentary).
- Each item: { "path": string, "content": string, "message": string }
- Maximum 5 files. Prefer title tags, meta descriptions, hero copy, headings, alt text, and JSON-LD schema markup.
- Text and marketing content only — do NOT refactor code structure, rename exports, or change imports.
- Do NOT modify config files, package.json, lockfiles, CI, or build scripts unless the finding explicitly requires a meta tag in an HTML file.
- Never invent file paths not provided in the input.
- Preserve existing code formatting and structure; change only the minimum text needed.
- If a finding cannot be addressed with the provided files, skip it rather than guessing.

Blocked paths (never edit): .env, node_modules, .git, secrets, credentials, keys.`;

export function buildGitHubChangesUserPrompt(params: {
  businessName: string;
  keyword: string;
  findings: Array<{ severity: string; category: string; title: string; description: string }>;
  files: Array<{ path: string; content: string }>;
  seoContext?: string;
}): string {
  const { businessName, keyword, findings, files, seoContext } = params;

  const findingsBlock =
    findings.length > 0
      ? findings
          .map((f) => `[${f.severity}/${f.category}] ${f.title}: ${f.description}`)
          .join('\n')
      : 'No findings provided.';

  const filesBlock =
    files.length > 0
      ? files
          .map((f) => `--- FILE: ${f.path} ---\n${f.content.slice(0, 12000)}`)
          .join('\n\n')
      : 'No file contents provided.';

  const seoBlock = seoContext?.trim()
    ? `\n\nHistorical SEO context (prior audits):\n${seoContext.trim()}\n`
    : '';

  return `Business: ${businessName}
Target keyword: ${keyword}
${seoBlock}
Audit findings to address:
${findingsBlock}

Editable files (full current contents):
${filesBlock}

Return a JSON array of file edits (max 5) that fix the highest-impact SEO/CRO issues.`;
}
