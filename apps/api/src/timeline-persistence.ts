import type { TimelineState } from "./timeline-reducer.js";

export type TimelinePersistenceDatabase = {
  $transaction<T>(operation: (tx: TimelinePersistenceDatabase) => Promise<T>): Promise<T>;
  canonicalTimelineEvent: { upsert(args: unknown): Promise<unknown> };
  txlineStreamCheckpoint: { upsert(args: unknown): Promise<unknown> };
};

export async function persistTimelineState(db: TimelinePersistenceDatabase, state: TimelineState): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const event of state.events) {
      await tx.canonicalTimelineEvent.upsert({
        where: { streamKind_fixtureId_eventId: { streamKind: event.stream_kind, fixtureId: event.fixture_id, eventId: event.event_id } },
        create: { eventId: event.event_id, streamKind: event.stream_kind, fixtureId: event.fixture_id, sequence: event.sequence, providerTimestamp: new Date(event.provider_timestamp), eventType: event.event_type ?? event.stream_kind, payload: structuredClone(event.payload) },
        update: { sequence: event.sequence, providerTimestamp: new Date(event.provider_timestamp), payload: structuredClone(event.payload) },
      });
    }
    if (state.checkpoint !== null) {
      const checkpoint = state.checkpoint;
      await tx.txlineStreamCheckpoint.upsert({
        where: { streamKind_fixtureId: { streamKind: checkpoint.stream_kind, fixtureId: checkpoint.fixture_id } },
        create: { streamKind: checkpoint.stream_kind, fixtureId: checkpoint.fixture_id, lastEventId: checkpoint.event_id, sequence: checkpoint.sequence, providerTimestamp: new Date(checkpoint.provider_timestamp), connectionStatus: "connected", updatedAt: new Date(checkpoint.updated_at) },
        update: { lastEventId: checkpoint.event_id, sequence: checkpoint.sequence, providerTimestamp: new Date(checkpoint.provider_timestamp), updatedAt: new Date(checkpoint.updated_at) },
      });
    }
  });
}
