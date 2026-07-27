/**
 * RFC 4122-shaped v4 identifier. Local-only ids need to be unique and stable,
 * not cryptographically strong; the Supabase schema uses the same UUID column
 * type, so ids generated offline stay valid after a sync.
 */
export function createId(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      out += '-';
    } else if (index === 14) {
      out += '4';
    } else if (index === 19) {
      out += hex[(Math.random() * 4) | 8];
    } else {
      out += hex[(Math.random() * 16) | 0];
    }
  }
  return out;
}
