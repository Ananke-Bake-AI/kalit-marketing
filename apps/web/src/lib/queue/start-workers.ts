/**
 * Standalone worker process — run alongside the Next.js dev server.
 * Usage: npx tsx src/lib/queue/start-workers.ts
 *
 * In production, workers start via instrumentation.ts inside the Next.js process.
 * In dev, they must run separately because BullMQ's Redis polling blocks
 * the Next.js dev server event loop.
 */
import { startSupervisor, stopSupervisor } from "./supervisor";

async function main() {
  console.log("[workers] Starting standalone worker process...");
  await startSupervisor();

  process.on("SIGINT", async () => {
    console.log("\n[workers] Shutting down...");
    await stopSupervisor();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await stopSupervisor();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[workers] Fatal error:", err);
  process.exit(1);
});
