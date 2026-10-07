import gameData from "./games.json";

export type GameId = keyof typeof gameData;
export const GAME_PROFILES = gameData;
