import { Card, CardColor, cardColors, Player, PlayedCard, Callings, AllPossibleCalls } from './types';
import { validateCalling, getCardValue, mulberry32, canBeatCard, canPlayCard } from './utils';

export class BotAI {
	static decideBid(player: Player): CardColor | 'pass' {
		const colorCounts: Record<CardColor, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 };
		const colorValues: Record<CardColor, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 };

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

		if (player.isDealer) {
			const rng = mulberry32(Date.now());
			return bestColor || cardColors[Math.floor(rng() * cardColors.length)]!;
		}

		return 'pass';
	}

	static decideCalling(player: Player, adut: CardColor): Card[] {
		const allPossibleCalls = this.findAllPossibleCalls(player.cards, adut);

		if (allPossibleCalls.length === 0) return [];

		allPossibleCalls.sort((a, b) => b.calling.type - a.calling.type);
		return allPossibleCalls[0]!.cards;
	}

	static decideCardToPlay(player: Player, currentTrick: PlayedCard[], adut: CardColor): Card {
		const allPlayerCards = [...player.cards, ...player.talon];

		const legalCards = allPlayerCards.filter((card) => canPlayCard(card, currentTrick, adut, allPlayerCards));
		if (legalCards.length === 0) throw new Error('No legal cards to play?');
		else if (legalCards.length === 1) return legalCards[0]!;

		// Leading - if no cards played, choose best card.
		if (currentTrick.length === 0) return this.chooseBestLeadingCard(legalCards, adut);
		// Following - try to win or play strategically.
		else return this.chooseBestFollowingCard(legalCards, currentTrick, adut);
	}

	static findAllPossibleCalls(cards: Card[], adut: CardColor): AllPossibleCalls[] {
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

	static chooseBestLeadingCard(cards: Card[], adut: CardColor): Card {
		// Prefer trump cards, then high-value cards.
		const trumpCards = cards.filter((c) => c.color === adut);
		if (trumpCards.length > 0) {
			return trumpCards.reduce((best, current) =>
				getCardValue(current, adut) > getCardValue(best, adut) ? current : best,
			);
		}

		// Otherwise play highest value card.
		return cards.reduce((best, current) => getCardValue(current, adut) > getCardValue(best, adut) ? current : best);
	}

	static chooseBestFollowingCard(cards: Card[], currentTrick: PlayedCard[], adut: CardColor): Card {
		const winningCards = cards.filter((card) => {
			return currentTrick.every((playedCard) => canBeatCard(card, playedCard, adut));
		});

		if (winningCards.length > 0) return winningCards.reduce((best, current) => getCardValue(current, adut) < getCardValue(best, adut) ? current : best);
		return cards.reduce((best, current) => getCardValue(current, adut) < getCardValue(best, adut) ? current : best);
	}
}
