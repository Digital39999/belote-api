import { Card, CardColor, cardColors, Player, PlayedCard, Callings, AllPossibleCalls } from './types';
import { validateCalling, findLegalCard, getCardValue, mulberry32, canBeatCard } from './utils';

export class BotAI {
	private rng: () => number;

	constructor (seed?: number) {
		this.rng = mulberry32(seed || Date.now());
	}

	public decideBid(player: Player, isDealer: boolean): CardColor | 'pass' {
		const colorCounts: Record<CardColor, number> = { herc: 0, karo: 0, tref: 0, pik: 0 };
		const colorValues: Record<CardColor, number> = { herc: 0, karo: 0, tref: 0, pik: 0 };

		for (const card of player.cards) {
			colorCounts[card.color]++;
			colorValues[card.color] += getCardValue(card, card.color);
		}

		let bestColor: CardColor | null = null;
		let bestScore = 0;

		for (const color of cardColors) {
			const score = colorCounts[color] * 2 + colorValues[color] * 0.1;
			if (score > bestScore) {
				bestScore = score;
				bestColor = color;
			}
		}

		const minCardsForBid = 3;
		const minScoreForBid = 6;

		if (bestColor && colorCounts[bestColor] >= minCardsForBid && bestScore >= minScoreForBid) {
			return bestColor;
		}

		if (isDealer) return bestColor || cardColors[Math.floor(this.rng() * cardColors.length)]!;

		return 'pass';
	}

	public decideCalling(player: Player, adut: CardColor): Card[] {
		const allPossibleCalls = this.findAllPossibleCalls(player.cards, adut);

		if (allPossibleCalls.length === 0) return [];

		// Sort by value (descending - higher value calls first)
		allPossibleCalls.sort((a, b) => b.calling.type - a.calling.type);
		return allPossibleCalls[0]!.cards;
	}

	public decideCardToPlay(player: Player, currentTrick: PlayedCard[], adut: CardColor): Card {
		const legalCards = player.cards.filter((card) => findLegalCard(currentTrick, adut, [card]) !== null);
		if (legalCards.length === 0) throw new Error('No legal cards to play?');
		else if (legalCards.length === 1) return legalCards[0]!;

		// Leading - if no cards played, choose best card
		if (currentTrick.length === 0) return this.chooseBestLeadingCard(legalCards, adut);
		// Following - try to win or play strategically
		else return this.chooseBestFollowingCard(legalCards, currentTrick, adut);
	}

	private findAllPossibleCalls(cards: Card[], adut: CardColor): AllPossibleCalls[] {
		const results: { cards: Card[], calling: { type: Callings } }[] = [];

		for (let i = 1; i < (1 << cards.length); i++) {
			const subset: Card[] = [];
			for (let j = 0; j < cards.length; j++) {
				if (i & (1 << j)) {
					subset.push(cards[j]!);
				}
			}

			const calling = validateCalling(subset, adut);
			if (calling) results.push({ cards: subset, calling });
		}

		return results;
	}

	private chooseBestLeadingCard(cards: Card[], adut: CardColor): Card {
		// Prefer trump cards, then high-value cards
		const trumpCards = cards.filter((c) => c.color === adut);
		if (trumpCards.length > 0) {
			return trumpCards.reduce((best, current) =>
				getCardValue(current, adut) > getCardValue(best, adut) ? current : best,
			);
		}

		// Otherwise play highest value card
		return cards.reduce((best, current) => getCardValue(current, adut) > getCardValue(best, adut) ? current : best);
	}

	private chooseBestFollowingCard(cards: Card[], currentTrick: PlayedCard[], adut: CardColor): Card {
		const winningCards = cards.filter((card) => {
			return currentTrick.every((playedCard) => canBeatCard(card, playedCard, adut));
		});

		if (winningCards.length > 0) return winningCards.reduce((best, current) => getCardValue(current, adut) < getCardValue(best, adut) ? current : best);
		return cards.reduce((best, current) => getCardValue(current, adut) < getCardValue(best, adut) ? current : best);
	}
}
