import { addDaysToKey, weekdayOf } from './time.js';

// weekdays use Date#getDay numbering (0 = Sunday). No weekdays = a one-off meeting.
export function expandSchedule({ startDate, weekdays = [], weeks = 1 }) {
  if (!weekdays.length) return [startDate];
  return Array.from({ length: Math.max(1, weeks) * 7 }, (_, i) => addDaysToKey(startDate, i))
    .filter((key) => weekdays.includes(weekdayOf(key)));
}
