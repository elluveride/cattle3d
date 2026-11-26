// Every point change is a ledger entry. Automatic entries (attendance, tasks)
// carry a `source` key so they can be recomputed without ever double-counting.

export const replaceSource = (ledger, source, entries) => [
  ...ledger.filter((entry) => entry.source !== source),
  ...entries,
];

export const totalsByMember = (ledger) =>
  ledger.reduce((totals, e) => totals.set(e.memberId, (totals.get(e.memberId) ?? 0) + e.delta), new Map());

export const entriesFor = (ledger, memberId) =>
  ledger.filter((e) => e.memberId === memberId).sort((a, b) => b.at - a.at);
