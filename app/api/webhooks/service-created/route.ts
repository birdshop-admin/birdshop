// The Run 1 foundation migration replaces the database HTTP trigger with transactional email jobs.
// A delayed call from the old trigger must not send a second email.
export async function POST() {
  return Response.json({ ok: true, handledBy: "email-jobs" });
}
