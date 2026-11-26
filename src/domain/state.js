export const STATE_VERSION = 1;

export const DEFAULT_SETTINGS = Object.freeze({
  teamName: 'Robotics Team',
  points: { present: 10, late: 5, excused: 0, absent: -5 },
  lateGraceMinutes: 10,
  checkInOpensMinutes: 30,
  subsystems: ['Drivetrain', 'Intake', 'Arm / Lift', 'Electronics', 'Programming', 'CAD', 'Outreach'],
  behaviorPresets: [
    { label: 'Helped a teammate', delta: 5 },
    { label: 'Cleaned up the shop', delta: 3 },
    { label: 'Outreach / volunteering', delta: 10 },
    { label: 'Safety glasses not worn', delta: -10 },
    { label: 'Left tools out', delta: -3 },
    { label: 'Off task / on phone', delta: -2 },
  ],
  admin: null,
  lastBackupAt: null,
});

export const emptyState = () => ({
  version: STATE_VERSION,
  settings: structuredClone(DEFAULT_SETTINGS),
  members: [],
  meetings: [],
  attendance: [],
  tasks: [],
  ledger: [],
});

const list = (value) => (Array.isArray(value) ? value : []);

export function normalize(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  return {
    version: STATE_VERSION,
    settings: { ...base.settings, ...settings, points: { ...base.settings.points, ...settings.points } },
    members: list(raw.members),
    meetings: list(raw.meetings),
    attendance: list(raw.attendance),
    tasks: list(raw.tasks),
    ledger: list(raw.ledger),
  };
}

export const looksLikeBackup = (raw) =>
  Boolean(raw) && typeof raw === 'object' && Array.isArray(raw.members) && typeof raw.settings === 'object';
