import { getDbClient } from "./db.js";

export type DbHealthResult = {
  configured: boolean;
  connected: boolean;
  checkedAt: string;
};

export async function checkDbHealth(): Promise<DbHealthResult> {
  const checkedAt = new Date().toISOString();

  if (!process.env.DATABASE_URL) {
    return {
      configured: false,
      connected: false,
      checkedAt
    };
  }

  try {
    await getDbClient().$queryRaw`SELECT 1`;
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
