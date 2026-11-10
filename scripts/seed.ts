import fs from "node:fs";
import { eq } from "drizzle-orm";
import { closeDb, dbPath, getDb } from "../src/db";
import { taskAssignments, users } from "../src/db/schema";
import { setClock } from "../src/lib/clock";
import { acknowledgeAssignment, addMessage, assignFollowUp, changeTaskStatus, createTask } from "../src/server/tasks";
import { at, createSeedUsers, DEFAULT_PASSWORD, freezeAt, runProjectReportScenario } from "./scenario";

const reset = process.argv.includes("--reset");
const file = dbPath();

if (reset) {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
}

if (getDb().select({ id: users.id }).from(users).get()) {
  console.log(`Database at ${file} already has users. Run "npm run db:seed -- --reset" to recreate it.`);
  closeDb();
  process.exit(0);
}

async function main() {
  const seedUsers = await createSeedUsers();
  const { a, b, c, d } = seedUsers;

  const scenario = runProjectReportScenario(seedUsers);

  freezeAt(at("15:10"));
  const invoices = createTask(a, {
    title: "Verify vendor invoices",
    description: "Check October vendor invoices against purchase orders.",
    dueDate: "2026-11-14",
    assigneeId: d.id,
    instruction: "Flag anything that does not match a PO.",
  });

  freezeAt(at("16:20"));
  const onboarding = createTask(b, {
    title: "Update onboarding checklist",
    description: "Refresh the checklist with the new IT access steps.",
    priority: "low",
    assigneeId: c.id,
  });
  freezeAt(at("16:45"));
  const onboardingAssignment = getDb()
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.taskId, onboarding.id))
    .get()!;
  acknowledgeAssignment(c, onboarding.id, onboardingAssignment.id, { response: "received" });
  freezeAt(at("17:00"));
  changeTaskStatus(c, onboarding.id, { status: "in_progress" });
  freezeAt(at("17:20"));
  addMessage(c, onboarding.id, { message: "Draft is ready, waiting on IT for the VPN section." });
  freezeAt(at("17:25"));
  assignFollowUp(c, onboarding.id, { assigneeId: a.id, instruction: "Please confirm the VPN request form link." });
  freezeAt(at("17:30"));
  changeTaskStatus(c, onboarding.id, { status: "waiting" });

  setClock(null);
  closeDb();

  console.log(`Seeded ${file}`);
  console.log(`  Task #${scenario.taskId} Prepare Project Report (completed, full 10-step history)`);
  console.log(`  Task #${invoices.id} Verify vendor invoices (assigned to User D, awaiting acknowledgement)`);
  console.log(`  Task #${onboarding.id} Update onboarding checklist (waiting, open follow-up for User A)`);
  console.log(`Sign in with any of: admin@example.com, usera@example.com, userb@example.com, userc@example.com, userd@example.com`);
  console.log(`Password: ${DEFAULT_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
