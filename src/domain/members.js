export const subteamsOf = (members) =>
  [...new Set(members.map((m) => m.subteam?.trim()).filter(Boolean))].sort();

export const sortMembers = (members) =>
  [...members].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

// "Ava Ramirez, Programming" -> { name: 'Ava Ramirez', subteam: 'Programming' }
export function parseMemberLines(text, defaultSubteam = '') {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(',');
      return { name: name.trim(), subteam: rest.join(',').trim() || defaultSubteam.trim() };
    })
    .filter((m) => m.name);
}

export const removeMember = (state, id) => ({
  ...state,
  members: state.members.filter((m) => m.id !== id),
  attendance: state.attendance.filter((r) => r.memberId !== id),
  ledger: state.ledger.filter((e) => e.memberId !== id),
  tasks: state.tasks.map((t) =>
    t.assigneeIds.includes(id) ? { ...t, assigneeIds: t.assigneeIds.filter((x) => x !== id) } : t,
  ),
});
