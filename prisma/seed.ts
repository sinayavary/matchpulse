import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const fixtureId = "17952170";

  await prisma.fixture.upsert({
    where: { fixtureId },
    update: {
      competition: "Friendlies",
      homeTeam: "Slovenia",
      awayTeam: "Cyprus",
      startTimeUtc: new Date("2026-06-04T16:00:00.000Z"),
      status: "UNKNOWN"
    },
    create: {
      fixtureId,
      competition: "Friendlies",
      homeTeam: "Slovenia",
      awayTeam: "Cyprus",
      startTimeUtc: new Date("2026-06-04T16:00:00.000Z"),
      status: "UNKNOWN"
    }
  });

  await prisma.matchState.upsert({
    where: { fixtureId },
    update: {
      homeScore: 1,
      awayScore: 1,
      phase: "unknown",
      marketMood: "unknown"
    },
    create: {
      fixtureId,
      homeScore: 1,
      awayScore: 1,
      phase: "unknown",
      marketMood: "unknown"
    }
  });
}

main()
  .catch(() => {
    console.error("Database seed failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
