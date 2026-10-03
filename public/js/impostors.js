// Small helpers for rounds with one or two impostors (two from six players).
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another
// module does not have would not load. New logic goes in new files.)

/** How many impostors this round has. A host that has not been updated yet says nothing, which means one. */
export const impostorCount = (view) => view?.turn?.impostors ?? 1;

/** For an impostor in a round with two: the other one, as [{ id, name, avatar }]. Everybody else gets []. */
export const matesOf = (you) => you?.mates ?? [];

/** "Ola", "Ola og Kari", "Ola, Kari og Per". */
export function joinNames(names) {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} og ${names.at(-1)}`;
}

/** The impostors named in a round summary, as [{ id, name, avatar }]. Somebody who has left the game since is still named. */
export function summaryImpostors(view) {
  const s = view.summary;
  const list = s.impostors ?? (s.impostor ? [s.impostor] : []); // (a host that has not been updated only knows one)
  return list.map((i) => view.players.find((p) => p.id === i.id) ?? i);
}
