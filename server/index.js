// Local/non-Vercel entry point. Run with `npm run server`.
// On Vercel, api/index.js is used instead -- see that file and vercel.json.
import { app, port, scheduledSnapshots } from './app.js';

const snapshotIntervalMinutes = Math.max(5, Number(process.env.SNAPSHOT_INTERVAL_MINUTES || 60));

app.listen(port, () => {
  console.log(`Bakeshop Weather API listening on :${port}`);
  console.log(`Scheduled snapshots every ${snapshotIntervalMinutes} minutes (local only -- on Vercel this is a Cron job instead).`);
  setTimeout(() => scheduledSnapshots(), 5000);
  setInterval(scheduledSnapshots, snapshotIntervalMinutes * 60 * 1000);
});
