import { CallingResult, Callings, CallingsCall, Card, CardColor, CardColorLocal, cardColors, CardPoints, CardPointsAdut, CardType, CardTypeLocal, cardTypeOrder, cardTypes, PlayedCard } from './types';

export function mulberry32(seed: number): () => number {
	return function () {
		let t = seed += 0x6D2B79F5;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function shuffleCards(deck: Card[], times: number = 1, rng?: () => number): Card[] {
	if (!Array.isArray(deck)) throw new Error('Deck must be an array of cards.');
	else if (times < 1) throw new Error('Times must be greater than 0.');

	const random = rng ?? mulberry32(Date.now());

	for (let t = 0; t < times; t++) {
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[deck[i], deck[j]] = [deck[j]!, deck[i]!];
		}
	}

	return deck;
}

export function getCardValue(card: Card, adut: CardColor) {
	if (card.color === adut) return CardPointsAdut[card.type];
	else return CardPoints[card.type];
}

export function getCardImageUrl(card: Card, size: 'large' | 'medium' | 'small' = 'medium', imageProvider: string): string {
	const localizedColor = cardColorLocalized(card.color);
	const localizedType = cardTypeLocalized(card.type);

	return `${imageProvider}/${size}/${localizedColor}/${localizedType}.webp`;
}

export function getCardColorImageUrl(color: CardColor, size: 'large' | 'medium' | 'small' = 'medium', imageProvider: string): string {
	const localizedColor = cardColorLocalized(color);
	return `${imageProvider}/${size}/colors/${localizedColor}.webp`;
}

export function createDeck(shuffle: number = 1): Card[] {
	const deck: Card[] = [];
	for (const color of cardColors) {
		for (const type of cardTypes) {
			deck.push({ color, type });
		}
	}

	return shuffleCards(deck, shuffle);
}

export function isConsecutiveSequence(cards: Card[]): boolean {
	for (let i = 0; i < cards.length - 1; i++) {
		const currIndex = cardTypeOrder.indexOf(cards[i]!.type);
		const nextIndex = cardTypeOrder.indexOf(cards[i + 1]!.type);
		if (nextIndex !== currIndex + 1) return false;
	}

	return true;
}

export function validateCalling(cards: Card[], adut: CardColor): CallingResult | null {
	let bestCall: CallingResult | null = null;

	const cardsByColor: Record<CardColor, Card[]> = { hearts: [], diamonds: [], clubs: [], spades: [] };
	const cardsByType: Record<CardType, Card[]> = {
		Ace: [], King: [], Queen: [], Jack: [], Ten: [], Nine: [], Eight: [], Seven: [],
	};

	for (const card of cards) {
		cardsByColor[card.color].push(card);
		cardsByType[card.type].push(card);
	}

	const tryUpdateBest = (call: CallingResult) => {
		if (!bestCall || call.type > bestCall.type) bestCall = call;
	};

	// 1. Check for Belot (8 cards of same color).
	for (const color of cardColors) {
		if (cards.length === 8 && cardsByColor[color].length === 8) {
			return { type: Callings.Belot };
		}
	}

	// 2. Check Bela: exactly 2 cards - King and Queen of adut.
	if (cards.length === 2 && cardsByColor[adut].some((c) => c.type === 'King') && cardsByColor[adut].some((c) => c.type === 'Queen')) {
		if (cards.every((c) => c.color === adut && (c.type === 'King' || c.type === 'Queen'))) {
			tryUpdateBest({ type: Callings.Bela });
		}
	}

	// 2. Check four of a kind.
	for (const type of ['Jack', 'Nine', 'Ace', 'King', 'Queen', 'Ten'] as CardType[]) {
		if (cards.length === 4 && cardsByType[type].length === 4) {
			switch (type) {
				case 'Jack': tryUpdateBest({ type: Callings.Jack4 }); break;
				case 'Nine': tryUpdateBest({ type: Callings.Nine4 }); break;
				case 'Ace': tryUpdateBest({ type: Callings.Ace4 }); break;
				case 'King': tryUpdateBest({ type: Callings.King4 }); break;
				case 'Queen': tryUpdateBest({ type: Callings.Queen4 }); break;
				case 'Ten': tryUpdateBest({ type: Callings.Ten4 }); break;
			}
		}
	}

	// 3. Check for sequences.
	if (cards.length >= 3) {
		const firstColor = cards[0]!.color;

		if (cards.every((c) => c.color === firstColor)) {
			const sortedCards = cards.slice().sort((a, b) => cardTypeOrder.indexOf(a.type) - cardTypeOrder.indexOf(b.type));
			if (isConsecutiveSequence(sortedCards)) {
				const callKey = `Sequence${cards.length}` as keyof typeof Callings;

				if (Callings[callKey]) tryUpdateBest({ type: Callings[callKey] });
				else if (cards.length >= 5) tryUpdateBest({ type: Callings.Sequence5 });
			}
		}
	}

	return bestCall;
}

export function getHighestCall(calls: CallingsCall[]): CallingsCall | null {
	if (calls.length === 0) return null;

	return calls.reduce((highest, current) => {
		if (!highest) return current;

		const comparison = compareCallStrength(current, highest);
		return comparison > 0 ? current : highest;
	});
}

export function compareCallStrength(call1: CallingsCall, call2: CallingsCall): number {
	const getCallStrength = (call: Callings): number => {
		switch (call) {
			case Callings.Sequence3: return 1;
			case Callings.Sequence4: return 2;
			case Callings.Sequence5: return 3;
			case Callings.Sequence6: return 4;
			case Callings.Sequence7: return 5;
			case Callings.Bela: return 6;
			case Callings.Ace4: return 7;
			case Callings.King4: return 8;
			case Callings.Queen4: return 9;
			case Callings.Jack4: return 10;
			case Callings.Nine4: return 11;
			case Callings.Ten4: return 12;
			case Callings.Belot: return 13;
			default: return 0;
		}
	};

	const strength1 = getCallStrength(call1.call);
	const strength2 = getCallStrength(call2.call);

	if (strength1 !== strength2) {
		return strength1 - strength2;
	}

	if (call1.call >= Callings.Sequence3 && call1.call <= Callings.Sequence7) {
		const highestCard1 = getHighestCardInSequence(call1.cards);
		const highestCard2 = getHighestCardInSequence(call2.cards);

		return CardPoints[highestCard1.type] - CardPoints[highestCard2.type];
	}

	return 0;
}

export function getHighestCardInSequence(cards: Card[]): Card {
	return cards.reduce((highest, current) => {
		return CardPoints[current.type] > CardPoints[highest.type] ? current : highest;
	});
}

export function canPlayCard(card: Card, currentTrick: PlayedCard[], adut: CardColor, playerCards: Card[]): boolean {
	if (currentTrick.length === 0) return true;

	const leadingSuit = currentTrick[0]!.color;
	const hasLeadingSuit = playerCards.some((c) => c.color === leadingSuit);

	// If player has leading suit, must follow suit.
	if (hasLeadingSuit) {
		if (card.color !== leadingSuit) return false;

		// If leading suit is trump, must play higher trump if possible.
		if (leadingSuit === adut) {
			const mustBeatCard = getHighestTrumpInTrick(currentTrick, adut);
			if (mustBeatCard && canBeatCard(card, mustBeatCard, adut)) {
				const hasHigherTrump = playerCards.some((c) => c.color === adut && canBeatCard(c, mustBeatCard, adut));
				return !hasHigherTrump || canBeatCard(card, mustBeatCard, adut);
			}
		} else {
			// Non-trump suit - must play higher if possible (unless trump was played).
			const trumpPlayed = currentTrick.some((c) => c.color === adut);
			if (!trumpPlayed) {
				const highestCard = getHighestNonTrumpInTrick(currentTrick, adut);
				if (highestCard && canBeatCard(card, highestCard, adut)) {
					const hasHigherCard = playerCards.some((c) => c.color === leadingSuit && canBeatCard(c, highestCard, adut));
					return !hasHigherCard || canBeatCard(card, highestCard, adut);
				}
			}
		}

		return true;
	}

	// No leading suit - must play trump if available.
	const hasTrump = playerCards.some((c) => c.color === adut);
	if (hasTrump) {
		if (card.color !== adut) return false;

		// Must beat highest trump if possible.
		const highestTrump = getHighestTrumpInTrick(currentTrick, adut);
		if (highestTrump) {
			const hasHigherTrump = playerCards.some((c) => c.color === adut && canBeatCard(c, highestTrump, adut));
			return !hasHigherTrump || canBeatCard(card, highestTrump, adut);
		}
	}

	// No leading suit, no trump - can play any card.
	return true;
}

export function findLegalCard(currentTrick: PlayedCard[], adut: CardColor, playerCards: Card[]): Card | null {
	return playerCards.find((card) => canPlayCard(card, currentTrick, adut, playerCards)) || null;
}

export function canBeatCard(card: Card, targetCard: Card, adut: CardColor): boolean {
	if (card.color === adut && targetCard.color === adut) return CardPointsAdut[card.type] > CardPointsAdut[targetCard.type];

	if (card.color === adut && targetCard.color !== adut) return true;
	if (card.color !== adut && targetCard.color === adut) return false;

	if (card.color === targetCard.color) {
		return CardPoints[card.type] > CardPoints[targetCard.type];
	}

	return false;
}

export function getHighestTrumpInTrick(trick: PlayedCard[], adut: CardColor): Card | null {
	const trumpCards = trick.filter((c) => c.color === adut);
	if (trumpCards.length === 0) return null;

	return trumpCards.reduce((highest, current) => CardPointsAdut[current.type] > CardPointsAdut[highest.type] ? current : highest);
}

export function getHighestNonTrumpInTrick(trick: PlayedCard[], adut: CardColor): Card | null {
	const nonTrumpCards = trick.filter((c) => c.color !== adut);
	if (nonTrumpCards.length === 0) return null;

	return nonTrumpCards.reduce((highest, current) => CardPoints[current.type] > CardPoints[highest.type] ? current : highest);
}

export function cardColorLocalized(color: CardColor): CardColorLocal {
	switch (color) {
		case 'hearts': return 'herc';
		case 'diamonds': return 'karo';
		case 'clubs': return 'tref';
		case 'spades': return 'pik';
	}
}

export function cardTypeLocalized(type: CardType): CardTypeLocal {
	switch (type) {
		case 'Ace': return 'As';
		case 'King': return 'Kralj';
		case 'Queen': return 'Baba';
		case 'Jack': return 'Decko';
		case 'Ten': return 'Deset';
		case 'Nine': return 'Devet';
		case 'Eight': return 'Osam';
		case 'Seven': return 'Sedam';
	}
}

export function normalizeLocalColor(color: CardColorLocal): CardColor {
	switch (color) {
		case 'herc': return 'hearts';
		case 'karo': return 'diamonds';
		case 'tref': return 'clubs';
		case 'pik': return 'spades';
	}
}

export function normalizeLocalType(type: CardTypeLocal): CardType {
	switch (type) {
		case 'As': return 'Ace';
		case 'Kralj': return 'King';
		case 'Baba': return 'Queen';
		case 'Decko': return 'Jack';
		case 'Deset': return 'Ten';
		case 'Devet': return 'Nine';
		case 'Osam': return 'Eight';
		case 'Sedam': return 'Seven';
	}
}
