// Editable prompt for generating SEO/CRO file edits from audit findings.

import { buildSeoLlmPromptBlock, buildSiteContextHint } from '@/lib/prompts/seo-llm-knowledge';

export const GITHUB_CHANGES_SYSTEM_PROMPT = `You are SynapseCRO's repository editor. Given audit findings and current file contents from a marketing website repository, propose conservative text and metadata edits that address SEO and CRO issues.

You propose surgical find-and-replace edits, NOT whole-file rewrites.

Rules:
- Return an "edits" array. Each edit: { "path": string, "oldString": string, "newString": string, "message": string }
- "oldString" MUST be an exact, character-for-character substring copied verbatim from the provided file content — including whitespace and indentation. Do not paraphrase or reformat it.
- "oldString" must be long/specific enough to occur EXACTLY ONCE in that file. If a snippet is ambiguous, include surrounding lines to make it unique.
- "newString" is the replacement for that exact snippet. Change only the minimum text needed.
- Keep each oldString/newString small and focused — a single tag, attribute, or sentence. Never paste an entire file.
- Maximum 8 edits total. Prefer title tags, meta descriptions, hero copy, headings, alt text, JSON-LD schema markup, and concise opening summaries.
- Text and marketing content only — do NOT refactor code structure, rename exports, change imports, or touch attributes/markup unrelated to the finding.
- Do NOT modify config files, package.json, lockfiles, CI, or build scripts unless the finding explicitly requires a meta tag in an HTML file.
- Never invent file paths not provided in the input.
- If a finding cannot be addressed with the provided files, skip it rather than guessing.

Blocked paths (never edit): .env, node_modules, .git, secrets, credentials, keys.
${buildSeoLlmPromptBlock('edit')}`;

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
          .map((f) => `--- FILE: ${f.path} ---\n${f.content.slice(0, 16000)}`)
          .join('\n\n')
      : 'No file contents provided.';

  const seoBlock = seoContext?.trim()
    ? `\n\nHistorical SEO context (ClickHouse — fix persistent issues first; items persisting 7+ days or across 2+ audits outrank new nitpicks):\n${seoContext.trim()}\n`
    : '';

  return `${buildSiteContextHint({ businessName, keyword })}
${seoBlock}
Audit findings to address:
${findingsBlock}

Editable files (full current contents):
${filesBlock}

Return an "edits" array of surgical find-and-replace edits (max 8) matched to site type. Do not add LocalBusiness schema, fake addresses, or borough landing pages unless findings and file content indicate a local service business. Copy each "oldString" verbatim from the file contents above.`;
}
