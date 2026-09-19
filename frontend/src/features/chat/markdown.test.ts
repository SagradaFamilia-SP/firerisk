import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('turns bold and bullet-list markdown into real HTML instead of literal asterisks', () => {
    const html = renderMarkdown('**Foco principal:** Huelva\n\n* Uno\n* Dos');
    expect(html).toContain('<strong>Foco principal:</strong>');
    expect(html).toContain('<li>Uno</li>');
    expect(html).toContain('<li>Dos</li>');
    expect(html).not.toContain('**');
  });

  it('turns headings into heading elements', () => {
    const html = renderMarkdown('### Informe operativo');
    expect(html).toMatch(/<h3[^>]*>Informe operativo<\/h3>/);
  });

  it('sanitizes script tags out of the model-generated text', () => {
    const html = renderMarkdown('Hola<script>alert(1)</script>mundo');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });
});
