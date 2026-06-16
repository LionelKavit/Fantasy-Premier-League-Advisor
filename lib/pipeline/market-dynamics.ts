import type { Player } from "../types";
import type { MarketSignals } from "./types";

export function computeMarketSignals(player: Player, maxEpNext: number): MarketSignals {
  const priceMovement =
    player.price > 0 ? player.costChangeEvent / player.price : 0;

  const ownershipScore = player.selectedByPercent / 100;

  const totalTransfers = player.transfersInEvent + player.transfersOutEvent;
  const transferMomentum =
    totalTransfers > 0
      ? (player.transfersInEvent - player.transfersOutEvent) / totalTransfers
      : 0;

  const epNextSignal =
    player.epNext !== null && maxEpNext > 0
      ? player.epNext / maxEpNext
      : 0.5;

  const differentialValue = 1 - ownershipScore;

  return {
    priceMovement,
    ownershipScore,
    transferMomentum,
    epNextSignal: Math.max(0, Math.min(1, epNextSignal)),
    differentialValue,
  };
}
