export const cardColors = ['herc', 'karo', 'tref', 'pik'] as const;
export type CardColor = typeof cardColors[number];

export const cardTypes = ['As', 'Kralj', 'Baba', 'Decko', 'Deset', 'Devet', 'Osam', 'Sedam'] as const;
export type CardType = typeof cardTypes[number];

export const cardTypeOrder: CardType[] = ['Sedam', 'Osam', 'Devet', 'Deset', 'Decko', 'Baba', 'Kralj', 'As'];

export enum CardPoints {
	As = 11,
	Kralj = 4,
	Baba = 3,
	Decko = 2,
	Deset = 10,
	Devet = 0,
	Osam = 0,
	Sedam = 0,
}

export enum CardPointsAdut {
	As = 11,
	Kralj = 4,
	Baba = 3,
	Decko = 20,
	Deset = 10,
	Devet = 14,
	Osam = 0,
	Sedam = 0,
}

export type Card = {
	color: CardColor;
	type: CardType;
}

export type PlayedCard = Card & {
	playerId: string;
}

export enum Callings {
	Belot = -1, // 8 cards of same color, instant win.
	Bela = 20, // Kralj and Baba of adut.

	Decko4 = 200,
	Devet4 = 150,
	As4 = 100,
	Kralj4 = 100,
	Baba4 = 100,
	Deset4 = 100,

	Niz3 = 20,
	Niz4 = 50,
	Niz5 = 100,
	Niz6 = 100,
	Niz7 = 100,
}

export enum GamePhase {
	Waiting,
	Dealing,
	Bidding,
	Calling,
	Playing,
	Finished,
}

export type EndValue = 501 | 701 | 1001;
export type MoveTime = 10 | 20 | 30 | 40 | 50 | 60;

export type GameOptions = {
	endValue: EndValue;
	moveTime: MoveTime;
	botDelayMs: number;
}

export type CallingResult = {
	type: Callings;
}

export type AllPossibleCalls = {
	cards: Card[];
	calling: CallingResult;
}

export type Trick = {
	cardsPlayed: PlayedCard[];
	winnerPlayerId?: string;
	winningCard?: Card;
}

export type Team = {
	id: number;
	name: string;
	score: number[];

	tricksHistory: Trick[];
}

export type Player = {
	id: string;
	name: string;
	teamId: number;

	color?: string; // Color for UI representation, not game logic.

	isReady: boolean;
	isDealer: boolean;
	isBot: boolean;

	cards: Card[];
	talon: Card[];
}

export type AdutCall = {
	playerId: string;
	call: CardColor | null;
}

export type CallingsCall = {
	playerId: string;
	call: Callings;
	cards: Card[];
}

export type GameState = {
	players: Player[];
	team1: Team;
	team2: Team;

	deck: Card[];
	round: number;

	adut: CardColor | null;
	bids: AdutCall[];
	calls: CallingsCall[];

	gamePhase: GamePhase;
	currentTrick: Trick | null;

	currentPlayerIndex: number;
	currentPlayerTimeLeft: number;

	isGameOver: boolean;
	winnerTeam?: Team;
}

// Declarations.
export type BeloteEvents = {
	// Player management events.
	playerJoined: (player: Player) => void;
	playerLeft: (playerId: string) => void;
	playerSwitchedTeam: (playerId: string, newTeamId: number) => void;
	playerReadyChanged: (playerId: string, isReady: boolean) => void;

	// Ready state events.
	allPlayersReady: () => void;
	notEnoughPlayers: () => void;

	// Game lifecycle events.
	gameStarted: (gameState: GameState) => void;
	gameEnded: (winnerTeam: Team) => void;

	roundStarted: (roundNumber: number, dealer: Player) => void;
	roundCompleted: (roundNumber: number, scores: { team1: number; team2: number }, winningTeam: Team, failedTeam?: Team) => void;

	// Timer events.
	timerUpdate: (timeLeft: number) => void;

	// Dealing phase events.
	initialCardsDealt: (playerCards: { playerId: string; cardCount: number }[]) => void;
	talonDealt: (playerTalon: { playerId: string; talon: Card[]; }[]) => void;

	// Bidding phase events.
	biddingStarted: (firstPlayer: Player) => void;
	bidMade: (playerId: string, call: CardColor | 'pass') => void;
	adutChosen: (adut: CardColor, playerId: string) => void;
	nextPlayerBid: (player: Player) => void;

	// Calling phase events.
	callingPhaseStarted: () => void;
	callMade: (playerId: string, cards: Card[], callingResult: CallingResult | null) => void;
	callingPhaseEnded: (winningCall: CallingsCall | null) => void;
	belotWin: (playerId: string, belotColor: CardColor) => void;

	// Playing phase events.
	playingPhaseStarted: () => void;
	cardPlayed: (playerId: string, card: Card) => void;
	nextPlayerMove: (player: Player) => void;
	trickCompleted: (trick: Trick, winnerId: string) => void;
	nextTrickStarted: (leadPlayer: Player) => void;
}
