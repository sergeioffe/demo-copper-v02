import React from "react";
import { CARD_REGISTRY } from "./registry.js";

interface CardPlayerProps {
  card: { cardType: string; props: Record<string, unknown> };
}

export function CardPlayer({ card }: CardPlayerProps) {
  const Component = CARD_REGISTRY[card.cardType];

  if (!Component) {
    console.warn(`[CardPlayer] unknown cardType: "${card.cardType}"`);
    return null; // say text was already rendered above; degrade silently
  }

  return (
    <div className="card-player-frame">
      <Component {...(card.props as any)} />
    </div>
  );
}

export default CardPlayer;
