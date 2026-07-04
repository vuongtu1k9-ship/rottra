import { db } from './src/infra/database/db-pool';
import { agentTraining } from './src/infra/database/schema';
import { like } from 'drizzle-orm';
async function run() {
  await db.delete(agentTraining).where(like(agentTraining.utterance, '%5 viên kẹo%'));
  console.log('Deleted');
  process.exit(0);
}
run();
