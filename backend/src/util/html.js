// Lightweight HTML → plain text converter.
// Not a full parser, but good enough for Neutara ticket content which uses
// basic rich-text (<p>, <br>, <h1-6>, <ul>/<ol>/<li>, <code>, <strong>, etc.).

const ENTITIES = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
};

export function htmlToText(input) {
  if (input == null) return '';
  if (typeof input !== 'string') return String(input);
  if (!/[<&]/.test(input)) return input;

  return input
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer)>/gi, '\n\n')
    .replace(/<\/(h[1-6])>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '  • ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z0-9#]+);/gi, (_, name) => ENTITIES[name.toLowerCase()] ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
