import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  matchpulsePrisma?: PrismaClient;
};

export function getDbClient() {
  if (globalForPrisma.matchpulsePrisma === undefined) {
    globalForPrisma.matchpulsePrisma = new PrismaClient();
  }

  return globalForPrisma.matchpulsePrisma;
}
