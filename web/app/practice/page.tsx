import DrillSuite from "../DrillSuite";
import { GAME_PROFILES, type GameId } from "../../lib/gameProfiles";

type PracticeSearch = {
  game?: string;
  dpi?: string;
  sensitivity?: string;
  cm360?: string;
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
  const cm360 = Number(params.cm360);
  const baseline = Number(params.baseline);
  const profile = GAME_PROFILES[game];
  const hasVerifiedSensitivity = profile.yawVerified && profile.yawDegreesPerCountAtSensitivityOne !== null
    && Number.isFinite(sensitivity) && sensitivity > 0;
  const hasSetup = Number.isFinite(dpi) && dpi > 0 && Number.isFinite(baseline) && baseline > 0;
  const label = hasVerifiedSensitivity
    ? `${profile.name} ${sensitivity.toFixed(3)}`
    : Number.isFinite(cm360) && cm360 > 0
      ? `${profile.name} · ${cm360.toFixed(1)} cm/360`
      : `${profile.name} · in-game conversion not verified`;

  return (
    <DrillSuite
      baselineCounts={hasSetup ? baseline : 0}
      candidateLabel={hasSetup ? label : null}
      gameDpi={hasSetup ? dpi : null}
      conversionVerified={hasSetup && hasVerifiedSensitivity}
    />
  );
}
