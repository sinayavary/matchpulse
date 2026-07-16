export type TimelineEvent = { event_id: string; stream_kind: "scores" | "odds"; fixture_id: string; sequence: number; provider_timestamp: string; event_type?: string; payload: unknown };
export type TimelineCheckpoint = { stream_kind: "scores" | "odds"; fixture_id: string; sequence: number; provider_timestamp: string; event_id: string; updated_at: string };
export type TimelineState = { events: TimelineEvent[]; checkpoint: TimelineCheckpoint | null; duplicate_count: number; gap_count: number };

export function createTimelineState(): TimelineState { return { events: [], checkpoint: null, duplicate_count: 0, gap_count: 0 }; }

export function reduceTimeline(state: TimelineState, event: TimelineEvent): TimelineState {
  if (!event.event_id || !event.fixture_id || !Number.isSafeInteger(event.sequence) || event.sequence < 0 || !Number.isFinite(Date.parse(event.provider_timestamp))) return state;
  if (state.events.some((item) => item.event_id === event.event_id)) return { ...state, duplicate_count: state.duplicate_count + 1 };
  const previous = state.checkpoint;
  const gap = previous !== null && event.sequence > previous.sequence + 1 ? 1 : 0;
  if (previous !== null && event.sequence <= previous.sequence) return { ...state, duplicate_count: state.duplicate_count + 1 };
  const checkpoint = { stream_kind: event.stream_kind, fixture_id: event.fixture_id, sequence: event.sequence, provider_timestamp: new Date(event.provider_timestamp).toISOString(), event_id: event.event_id, updated_at: new Date().toISOString() };
  return { events: [...state.events, { ...event, provider_timestamp: new Date(event.provider_timestamp).toISOString() }], checkpoint, duplicate_count: state.duplicate_count, gap_count: state.gap_count + gap };
}
