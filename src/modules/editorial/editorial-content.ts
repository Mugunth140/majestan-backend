import sanitizeHtml from 'sanitize-html';
export function cleanContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: [
      'p',
      'br',
      'h2',
      'h3',
      'h4',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'blockquote',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'pre',
      'code',
      'hr',
      'sup',
      'sub',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      p: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    allowProtocolRelative: false,
    allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/] } },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: 'noopener noreferrer' },
      }),
    },
  });
}
export function contentText(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}
export function safeImageUrl(value: string): boolean {
  if (!value) return true;
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
