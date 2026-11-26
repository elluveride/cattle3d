import kiosk from './views/kiosk.js';
import leaderboard from './views/leaderboard.js';
import member from './views/member.js';
import robot from './views/robot.js';
import notFound from './views/notFound.js';
import gate from './views/admin/gate.js';
import members from './views/admin/members.js';
import codes from './views/admin/codes.js';
import meetings from './views/admin/meetings.js';
import meeting from './views/admin/meeting.js';
import points from './views/admin/points.js';
import settings from './views/admin/settings.js';

const PUBLIC = { kiosk, leaderboard, member, robot };
const ADMIN = { members, codes, meetings, meeting, points, settings };

const safeDecode = (part) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

export function parseHash(hash) {
  const [path = '', query = ''] = String(hash).replace(/^#\/?/, '').split('?');
  return {
    parts: path.split('/').filter(Boolean).map(safeDecode),
    params: Object.fromEntries(new URLSearchParams(query)),
  };
}

export const isKioskRoute = ({ parts }) => !parts.length || parts[0] === 'kiosk';

export function resolveView({ parts }, admin) {
  const [top = 'kiosk', sub = 'members'] = parts;
  if (top !== 'admin') return Object.hasOwn(PUBLIC, top) ? PUBLIC[top] : notFound;
  if (!admin) return gate;
  return Object.hasOwn(ADMIN, sub) ? ADMIN[sub] : notFound;
}
