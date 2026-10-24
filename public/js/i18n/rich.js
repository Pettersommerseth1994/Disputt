// A translated sentence with something in it that is not text (a <strong> name): `rich(t('Gi telefonen til {name}'), { name: html`<strong>…</strong>` })`.
// The sentence keeps its word order in every language; the pieces come back as a list of strings and nodes.
// (A file of its own: browsers may hold an older util.js in their cache for a few minutes after a deploy, and a module that imports something the
// cached copy lacks does not load at all.)

export const rich = (text, vars) => text.split(/\{(\w+)\}/).map((part, i) => (i % 2 ? vars[part] : part));
