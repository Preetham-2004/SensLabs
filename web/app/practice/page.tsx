import DrillSuite from "../DrillSuite";
import { GAME_PROFILES, type GameId } from "../../lib/gameProfiles";

type PracticeSearch = {
  game?: string;
  dpi?: string;
  sensitivity?: string;
  baseline?: string;
};

function validGame(value: string | undefined): GameId {
  return value === "valorant" ? "valorant" : "cs2";
}

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<PracticeSearch>;
}) {
  const params = await searchParams;
  const game = validGame(params.game);
  const dpi = Number(params.dpi);
  const sensitivity = Number(params.sensitivity);
  const baseline = Number(params.baseline);
  const hasSetup = Number.isFinite(dpi) && dpi > 0 && Number.isFinite(sensitivity) && sensitivity > 0
    && Number.isFinite(baseline) && baseline > 0;

  return (
    <DrillSuite
      baselineCounts={hasSetup ? baseline : 0}
      candidateLabel={hasSetup ? `${GAME_PROFILES[game].name} ${sensitivity.toFixed(3)}` : null}
      gameDpi={hasSetup ? dpi : null}
    />
  );
}
