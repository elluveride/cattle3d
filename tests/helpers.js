import { reducer } from '../src/domain/reducer.js';
import { emptyState } from '../src/domain/state.js';
import { at } from '../src/domain/time.js';

export const DAY = '2026-03-02'; // a Monday
export const T = (hhmm, date = DAY) => at(date, hhmm);
export const run = (actions, state = emptyState()) => actions.reduce(reducer, state);

export const team = () =>
  run([
    {
      type: 'members/added',
      at: T('08:00', '2026-02-01'),
      members: [
        { id: 'a', name: 'Ava R', subteam: 'Build', code: '1111' },
        { id: 'b', name: 'Ben T', subteam: 'Code', code: '2222' },
        { id: 'c', name: 'Cy L', subteam: 'Build', code: '3333' },
      ],
    },
    { type: 'meetings/scheduled', meetings: [{ id: 'm1', title: 'Build', date: DAY, start: '15:30', end: '18:00' }] },
  ]);
