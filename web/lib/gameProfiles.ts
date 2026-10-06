export type GameId = "cs2" | "valorant";

export const GAME_PROFILES: Record<GameId, {
  name: string;
  yawDegreesPerCountAtSensitivityOne: number;
  yawIsApproximate: boolean;
  yawSource: string;
  yawSourceUrl: string;
}> = {
  cs2: {
    name: "CS2",
    yawDegreesPerCountAtSensitivityOne: 0.022,
    yawIsApproximate: true,
    yawSource: "KovaaK's converter (Counter-Strike / Source value); cross-checked with CS2 reference",
    yawSourceUrl: "https://www.kovaak.com/kovaaks/sens-converter",
  },
  valorant: {
    name: "VALORANT",
    yawDegreesPerCountAtSensitivityOne: 0.06996,
    yawIsApproximate: true,
    yawSource: "KovaaK's converter; some references round this to 0.07",
    yawSourceUrl: "https://www.kovaak.com/kovaaks/sens-converter",
  },
};
