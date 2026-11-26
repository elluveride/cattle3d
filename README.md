# Team Tracker

Attendance, robot-task progress, behavior points and a leaderboard for a robotics team.
It's a static site with no server, no build step and no dependencies, so it runs on GitHub Pages as-is.

## How points work

Everything that changes a score writes one entry to a single **points ledger**. The leaderboard is just each member's sum.

| Source | When it happens | Default points |
| --- | --- | --- |
| Attendance | Meeting check-in: present / late / excused / absent | +10 / +5 / 0 / −5 |
| Robot tasks | A task moves to **Done**, and every assignee is paid | The task's value |
| Behavior | An admin awards or deducts (quick presets or custom) | Whatever you set |

Automatic entries are tied to their source, so changing someone's status or moving a task back out of Done
*replaces* the entry instead of stacking a second one. All values and presets are editable in **Admin → Settings**.

## Attendance

1. An admin schedules meetings (one-off, or weekly like Mon/Wed/Fri for 8 weeks) or hits **Start a meeting now**.
2. The **Check in** screen opens 30 minutes before start. Members type their 4-digit code. The first entry checks
   them in and the second checks them out, so shop hours are tracked too.
3. Checked in within 10 minutes of start counts as **present**. After that it's **late**.
4. When the meeting is over, an admin **closes** it. Anyone who never checked in is marked **absent**, and
   anyone still checked in is checked out. Mark excused absences before closing. **Reopen** undoes what closing did.

Attendance % = (present + late) ÷ (present + late + absent). Excused meetings don't count against anyone.

## Running it

- **Locally:** `npm start`, then open http://localhost:8080 (Node 20+). Any static file server works.
  Opening `index.html` straight from disk won't, because browsers block ES modules on `file://`.
- **GitHub Pages:** publish from the repo root. `CNAME` keeps the custom domain.
- **Tests:** `npm test`, which runs Node's built-in test runner against the pure logic in `src/domain`.
- **Demo:** on first launch, choose *Try it with demo data*. Demo check-in codes are `1001`–`1010`.

## Limits to know about

- **Data lives in one browser.** Everything is saved to `localStorage` on the device you use. Pick one kiosk
  device (shop laptop or tablet) and export a backup weekly (**Admin → Settings → Export backup**). A different
  device or browser starts out empty.
- **The admin PIN keeps honest people honest.** It stops students from wandering into admin on the kiosk.
  Someone with browser dev tools on that machine could still edit the data. Real protection needs a backend.
- Opening the Check in screen locks admin automatically, and admin also locks itself after 15 idle minutes.

## Code map

```
src/
  domain/      pure logic, no DOM: reducer, attendance, tasks, ledger, leaderboard
  ui/          tagged-template rendering, router, views (kiosk, leaderboard, robot, admin/*)
  store.js     localStorage persistence + cross-tab sync
  main.js      wiring: render loop and delegated events
tests/         node:test suites for src/domain
scripts/serve.js   zero-dependency static server for local use
```

Every change is an action like `{ type: 'attendance/checkedIn', ... }` that goes through one pure reducer
(`src/domain/reducer.js`). That keeps the logic testable and makes a future shared backend a storage swap,
not a rewrite.
