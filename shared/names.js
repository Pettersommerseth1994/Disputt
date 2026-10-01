// Names that look the same must not sit side by side in a lobby: two "Mari"s, or a "Mari" typed with a Cyrillic "а".
// (A new file rather than a new export in util.js: browsers may hold an older util.js in their cache for a few minutes
// after a deploy, and a module that imports something the cached copy lacks does not load at all.)

// Lower-case letters of other alphabets that are drawn exactly like a Latin one.
const LOOKALIKES = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', // Cyrillic
  'ο': 'o', 'ν': 'v', 'ρ': 'p', 'ι': 'i', 'κ': 'k', // Greek
  'ı': 'i', // Latin dotless i
};

/** What two names are compared by: case, compatibility forms (ｍａｒｉ), invisible characters, spacing and lookalikes are ignored. */
export function nameKey(name) {
  const plain = String(name).normalize('NFKC').toLowerCase().replace(/[\p{Default_Ignorable_Code_Point}\s]/gu, '');
  return Array.from(plain, (c) => LOOKALIKES[c] ?? c).join('');
}
