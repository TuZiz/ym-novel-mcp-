import { createApp, type AppInstance } from "../src/server.js";

export function createTestApp(): AppInstance {
  return createApp({ dbPath: ":memory:" });
}
