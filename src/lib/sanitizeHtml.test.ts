import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('allows safe tags', () => {
    const input = '<p><b>Hello</b> <i>World</i></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('removes script tags', () => {
    const input = '<p>Hello</p><script>alert("XSS")</script>';
    expect(sanitizeHtml(input)).toBe('<p>Hello</p>');
  });

  it('removes iframe tags', () => {
    const input = '<p>Hello</p><iframe src="http://evil.com"></iframe>';
    expect(sanitizeHtml(input)).toBe('<p>Hello</p>');
  });

  it('removes style tags', () => {
    const input = '<p>Hello</p><style>body { display: none; }</style>';
    expect(sanitizeHtml(input)).toBe('<p>Hello</p>');
  });

  it('adds target="_blank" and rel="noopener noreferrer" to a tags', () => {
    const input = '<a href="https://google.com">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toMatch(/<a href="https:\/\/google\.com" target="_blank" rel="noopener noreferrer">Link<\/a>/);
  });

  it('handles null or undefined', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });
});
