import 'dotenv/config';
import { klaviyoQueue } from '../queue/queues';

const jobName = process.argv[2];

if (!jobName) {
  process.stderr.write('Usage: npx tsx src/scripts/addJob.ts <job-name>\n');
  process.exit(1);
}

async function main() {
  await klaviyoQueue.add(jobName, {});
  console.log(`added: ${jobName}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
