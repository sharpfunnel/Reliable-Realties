import { existsSync } from "node:fs";

import { defineConfig, env } from "prisma/config";

// prisma.config.ts is loaded without dotenv support by the Prisma CLI itself,
// so .env must be loaded explicitly here for `prisma generate`/`migrate`.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_DATABASE_URL"),
  },
});
