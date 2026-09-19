import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

/**
 * The assistant's reply comes from an LLM as Markdown (headings, bold,
 * bullet lists); rendered as plain text it shows the raw `**`/`###`/`*`
 * characters instead of real formatting. Sanitized since this text is
 * model-generated, not something we authored ourselves.
 */
export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { async: false }));
}
