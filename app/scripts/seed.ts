/**
 * Seed script: creates a demo project with an API key and two meters.
 * Prints the plaintext API key once.  Run: npm run seed
 */
import "dotenv/config";
import { db, schema } from "@/db";
import { generateApiKey } from "@/lib/auth";

async function main() {
  const [project] = await db
    .insert(schema.projects)
    .values({
      name: "Demo API",
      description: "Showcase project for the Quota control plane demo",
    })
    .returning();

  const { key, keyHash, keyPrefix } = generateApiKey();
  await db.insert(schema.apiKeys).values({
    projectId: project.id,
    name: "Default key",
    keyHash,
    keyPrefix,
  });

  await db.insert(schema.meters).values([
    {
      projectId: project.id,
      name: "Rate limit (60/min per key)",
      kind: "rate",
      scope: "key",
      limit: 60,
      periodSeconds: 60,
    },
    {
      projectId: project.id,
      name: "Daily quota (20/day per project)",
      kind: "quota",
      scope: "project",
      limit: 20,
      period: "day",
    },
  ]);

  console.log(`Project:   ${project.name} (${project.id})`);
  console.log(`API key:   ${key}`);
  console.log("Store it now — it is not retrievable later.");
  process.exit(0);
}

main();
