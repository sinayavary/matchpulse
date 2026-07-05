import MatchDetailView from "../../../components/matches/MatchDetailView";

export default async function MatchRoomPage({
  params
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;

  return <MatchDetailView fixtureId={fixtureId} />;
}
