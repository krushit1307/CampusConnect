import DOMPurify from 'dompurify';
import { createRequire } from 'module';

let purify = DOMPurify;
if (typeof window === 'undefined') {
  const require = createRequire(import.meta.url);
  const { JSDOM } = require('jsdom');
  const window = new JSDOM('').window;
  purify = DOMPurify(window as unknown as Window);
}

purify.addHook('afterSanitizeAttributes', (node) => {
  if ('target' in node) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeHtml(dirtyString: string | null | undefined): string {
  if (!dirtyString) return '';
  
  return purify.sanitize(dirtyString, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    FORBID_TAGS: ['iframe', 'script', 'style', 'object'],
  });
}
