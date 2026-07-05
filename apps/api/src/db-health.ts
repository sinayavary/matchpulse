import { getDbClient } from "./db.js";

export type DbHealthResult = {
  configured: boolean;
  connected: boolean;
  checkedAt: string;
};

type DbHealthOptions = {
  databaseUrl?: string | null;
  query?: () => Promise<unknown>;
  now?: () => Date;
};

async function queryDatabase() {
  return getDbClient().$queryRaw`SELECT 1`;
}

export async function checkDbHealth({
  databaseUrl = process.env.DATABASE_URL,
  query = queryDatabase,
  now = () => new Date()
}: DbHealthOptions = {}): Promise<DbHealthResult> {
  const checkedAt = now().toISOString();

  if (!databaseUrl) {
    return {
      configured: false,
      connected: false,
      checkedAt
    };
  }

  try {
    await query();
    return {
      configured: true,
      connected: true,
      checkedAt
    };
  } catch {
    return {
      configured: true,
      connected: false,
      checkedAt
    };
  }
}
