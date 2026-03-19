export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Start supervisor workers — in dev mode too so the dashboard works end-to-end
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { startSupervisor } = await import("./lib/queue/supervisor");
      await startSupervisor();
    }
  }
}
