import { GameState, GamePhase, CardColor, Player, Card, GameOptions, Callings, Trick, CallingsCall, cardColors, PlayedCard, BeloteEvents, AllowedPlayerKeys } from './types';
import { createDeck, shuffleCards, validateCalling, canPlayCard, findLegalCard, getHighestCall, compareCallStrength, canBeatCard, getCardValue } from './utils';
import { EventEmitter } from 'events';
import { BotAI } from './bot';

export class Belote extends EventEmitter {
	private timeoutId: NodeJS.Timeout | null = null;
	public readonly options: GameOptions;
	public readonly gameState: GameState;

	constructor (init?: Partial<GameOptions>) {
		super();

		this.options = Object.assign({
			endValue: 501,
			moveTime: 30,
			botDelayMs: 1000,
		}, init);

		this.gameState = {
			players: [],
			team1: { id: 1, name: 'Team 1', score: [], tricksHistory: [] },
			team2: { id: 2, name: 'Team 2', score: [], tricksHistory: [] },
			deck: createDeck(),
			round: 0,
			adut: null,
			bids: [],
			calls: [],
			gamePhase: GamePhase.Waiting,
			currentTrick: null,
			currentPlayerIndex: 0,
			currentPlayerTimeLeft: this.options.moveTime,
			isGameOver: false,
		};
	}

	private createPlayer(playerName?: string, options?: Partial<Pick<Player, AllowedPlayerKeys | 'isReady' | 'isBot'>>): Player {
		if (this.gameState.players.length >= 4) throw new Error('Cannot add more than 4 players.');
		else if (options?.id && this.gameState.players.some((p) => p.id === options.id)) throw new Error(`Player with ID ${options.id} already exists.`);
		else if (options?.teamId && options.teamId !== 1 && options.teamId !== 2) throw new Error(`Invalid team ID: ${options.teamId}. Must be 1 or 2.`);
		else if (options?.teamId && this.gameState.players.filter((p) => p.teamId === options.teamId).length >= 2) throw new Error(`Team ${options.teamId} is already full.`);

		const idPrefix = options?.isBot ? 'bot' : 'player';
		const defaultName = options?.isBot ? 'Bot' : 'Player';
		const playerIndex = this.gameState.players.length + 1;

		const newPlayer: Player = {
			id: options?.id || `${idPrefix}-${playerIndex}`,
			name: playerName || `${defaultName} ${playerIndex}`,
			teamId: options?.teamId || (this.gameState.players.length % 2 === 0 ? 1 : 2),
			isReady: options?.isBot ? true : options?.isReady || false,
			isDealer: this.gameState.players.length === 0,
			isBot: options?.isBot || false,
			cards: [],
			talon: [],
		};

		this.gameState.players.push(newPlayer);
		this.emit('playerJoined', newPlayer);

		if (this.gameState.players.length === 4 && this.gameState.players.every((p) => p.isReady)) {
			this.emit('allPlayersReady');
		}

		return newPlayer;
	}

	public playerJoin(playerName?: string, options?: Partial<Pick<Player, AllowedPlayerKeys>>): Player {
		return this.createPlayer(playerName, options);
	}

	public playerLeave(playerId: string): void {
		const playerIndex = this.gameState.players.findIndex((p) => p.id === playerId);
		if (playerIndex === -1) throw new Error(`Player with ID ${playerId} does not exist.`);

		const [removedPlayer] = this.gameState.players.splice(playerIndex, 1);
		this.emit('playerLeft', removedPlayer!.id);

		if (this.gameState.players.length < 4) {
			this.clearTimer();
			this.emit('notEnoughPlayers');
		}
	}

	public addBot(botName?: string, options?: Partial<Pick<Player, AllowedPlayerKeys>>): Player {
		return this.createPlayer(botName, { ...options, isBot: true, isReady: true });
	}

	public removeBot(botId: string): void {
		this.playerLeave(botId);
	}

	public updatePlayer(playerId: string, updates: Partial<Player> | ((player: Player) => Partial<Player>)): void {
		const player = this.gameState.players.find((p) => p.id === playerId);
		if (!player) throw new Error(`Player with ID ${playerId} does not exist.`);

		if (typeof updates === 'function') Object.assign(player, updates(player));
		else Object.assign(player, updates);
	}

	public switchPlayerTeam(playerId: string, newTeamId: number): void {
		const player = this.gameState.players.find((p) => p.id === playerId);
		if (!player) throw new Error(`Player with ID ${playerId} does not exist.`);
		else if (newTeamId !== 1 && newTeamId !== 2) throw new Error(`Team ID ${newTeamId} does not exist.`);
		else if (player.teamId === newTeamId) throw new Error(`Player with ID ${playerId} is already in team ${newTeamId}.`);
		else if (this.gameState.players.filter((p) => p.teamId === newTeamId).length >= 2) throw new Error(`Team ${newTeamId} is already full.`);

		this.updatePlayer(playerId, { teamId: newTeamId });
		this.emit('playerSwitchedTeam', playerId, newTeamId);
	}

	public setPlayerReady(playerId: string, isReady: boolean): void {
		const player = this.gameState.players.find((p) => p.id === playerId);
		if (!player) throw new Error(`Player with ID ${playerId} does not exist.`);
		else if (player.isBot) return;

		this.updatePlayer(playerId, { isReady });
		this.emit('playerReadyChanged', playerId, isReady);

		if (this.gameState.players.length === 4 && this.gameState.players.every((p) => p.isReady)) {
			this.emit('allPlayersReady');
		}
	}

	private clearTimer(): void {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}

	private startTimer(duration: number, onTimeout: () => void): void {
		this.clearTimer();
		this.gameState.currentPlayerTimeLeft = duration;

		const startTime = Date.now();
		const updateInterval = setInterval(() => {
			const elapsed = Math.floor((Date.now() - startTime) / 1000);
			this.gameState.currentPlayerTimeLeft = Math.max(0, duration - elapsed);
			this.emit('timerUpdate', this.gameState.currentPlayerTimeLeft);

			if (this.gameState.currentPlayerTimeLeft <= 0) clearInterval(updateInterval);
		}, 1000);

		this.timeoutId = setTimeout(() => {
			clearInterval(updateInterval);
			onTimeout();
		}, duration * 1000);
	}

	private handleBotAction(action: () => void): void {
		setTimeout(action, this.options.botDelayMs);
	}

	public startGame(): void {
		if (this.gameState.players.length < 4) throw new Error('Need 4 players to start');
		if (this.gameState.players.some((p) => !p.isReady)) throw new Error('All players must be ready');

		this.gameState.round = 0;
		this.gameState.isGameOver = false;
		this.gameState.team1.score = [];
		this.gameState.team2.score = [];
		this.gameState.team1.tricksHistory = [];
		this.gameState.team2.tricksHistory = [];

		this.emit('gameStarted', this.gameState);
		this.startNextRound();
	}

	public startNextRound(): void {
		if (this.gameState.isGameOver) return;

		this.gameState.round++;
		this.gameState.adut = null;
		this.gameState.bids = [];
		this.gameState.calls = [];
		this.gameState.currentTrick = null;

		for (const player of this.gameState.players) {
			player.cards = [];
			player.talon = [];
		}

		const currentDealerIndex = this.gameState.players.findIndex((p) => p.isDealer);
		for (const player of this.gameState.players) this.updatePlayer(player.id, { isDealer: false });

		const nextDealerIndex = (currentDealerIndex + 1) % 4;
		const nextDealer = this.gameState.players[nextDealerIndex];
		if (!nextDealer) throw new Error('No players available to be dealer.');

		this.updatePlayer(nextDealer.id, { isDealer: true });
		this.emit('roundStarted', this.gameState.round, this.gameState.players[nextDealerIndex]!);

		this.dealInitialCards();
	}

	private dealInitialCards(): void {
		this.gameState.gamePhase = GamePhase.Dealing;
		this.gameState.deck = shuffleCards(createDeck());

		for (let round = 0; round < 2; round++) {
			for (const player of this.gameState.players) {
				const threeCards = this.gameState.deck.splice(0, 3);
				player.cards.push(...threeCards);
			}
		}

		this.emit('initialCardsDealt', this.gameState.players.map((p) => ({
			playerId: p.id,
			cardCount: p.cards.length,
		})));

		this.startBidding();
	}

	public getCurrentPlayer(): Player {
		return this.gameState.players[this.gameState.currentPlayerIndex]!;
	}

	private startBidding(): void {
		this.gameState.gamePhase = GamePhase.Bidding;
		const dealerIndex = this.gameState.players.findIndex((p) => p.isDealer);
		this.gameState.currentPlayerIndex = (dealerIndex + 1) % 4;

		this.emit('biddingStarted', this.getCurrentPlayer());

		const currentPlayer = this.getCurrentPlayer();
		if (currentPlayer.isBot) {
			this.handleBotAction(() => {
				const botDecision = BotAI.decideBid(currentPlayer);
				this.bid(currentPlayer.id, botDecision);
			});
		} else {
			this.startTimer(this.options.moveTime, () => {
				this.bid(this.getCurrentPlayer().id, 'pass');
			});
		}
	}

	public bid(playerId: string, call: CardColor | 'pass'): void {
		const player = this.gameState.players.find((p) => p.id === playerId);
		if (!player) throw new Error(`Player with ID ${playerId} does not exist.`);
		if (this.gameState.gamePhase !== GamePhase.Bidding) throw new Error('Not in bidding phase.');

		const currentPlayer = this.getCurrentPlayer();
		if (player.id !== currentPlayer.id) throw new Error(`It's not player ${playerId}'s turn.`);
		else if (call === 'pass' && player.isDealer) throw new Error('Dealer cannot pass during bidding.');

		this.clearTimer();

		this.gameState.bids.push({
			playerId: player.id,
			call: call === 'pass' ? null : call,
		});

		this.emit('bidMade', playerId, call);

		if (call !== 'pass') {
			this.gameState.adut = call;
			this.emit('adutChosen', call, playerId);
			this.dealTalon();
			return;
		}

		this.advanceBidding();
	}

	private advanceBidding(): void {
		this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % 4;

		const adutCalls = this.gameState.bids.filter((c) => 'call' in c && (c.call === null || typeof c.call === 'string'));

		if (adutCalls.length < 4) {
			this.emit('nextPlayerBid', this.getCurrentPlayer());

			const currentPlayer = this.getCurrentPlayer();
			if (currentPlayer.isBot) {
				this.handleBotAction(() => {
					const botDecision = BotAI.decideBid(currentPlayer);
					this.bid(currentPlayer.id, botDecision);
				});
			} else {
				this.startTimer(this.options.moveTime, () => {
					const currentPlayer = this.getCurrentPlayer();
					const randomColor = cardColors[Math.floor(Math.random() * cardColors.length)]!;

					this.bid(currentPlayer.id, currentPlayer.isDealer ? randomColor : 'pass');
				});
			}
		}
	}

	private dealTalon(): void {
		for (const player of this.gameState.players) {
			const twoCards = this.gameState.deck.splice(0, 2);
			player.talon.push(...twoCards);
		}

		this.emit('talonDealt', this.gameState.players.map((p) => ({
			playerId: p.id,
			talon: p.talon,
		})));

		this.startCallingPhase();
	}

	private startCallingPhase(): void {
		this.gameState.gamePhase = GamePhase.Calling;
		this.emit('callingPhaseStarted');

		for (const player of this.gameState.players) {
			if (player.isBot) {
				this.handleBotAction(() => {
					const hasAlreadyCalled = this.gameState.calls.some((call) => call.playerId === player.id);
					if (!hasAlreadyCalled && this.gameState.adut) {
						const allPlayerCards = [...player.cards, ...player.talon];
						const botDecision = BotAI.decideCalling(
							{ ...player, cards: allPlayerCards },
							this.gameState.adut,
						);
						this.makeCall(player.id, botDecision);
					}
				});
			}
		}

		this.startTimer(this.options.moveTime, () => {
			for (const player of this.gameState.players) {
				const hasAlreadyCalled = this.gameState.calls.some((call) => call.playerId === player.id);
				if (!hasAlreadyCalled) {
					this.makeCall(player.id, []);
				}
			}
		});
	}

	public makeCall(playerId: string, cards: Card[]): void {
		const player = this.gameState.players.find((p) => p.id === playerId);
		if (!player) throw new Error(`Player with ID ${playerId} does not exist.`);
		if (this.gameState.gamePhase !== GamePhase.Calling) throw new Error('Not in calling phase.');

		const hasAlreadyCalled = this.gameState.calls.some((call) => call.playerId === playerId);
		if (hasAlreadyCalled) throw new Error('Player has already made a call.');

		if (!this.gameState.adut) throw new Error('Adut must be chosen before making calls.');
		this.clearTimer();

		const callingResult = validateCalling(cards, this.gameState.adut);
		if (callingResult && cards.length > 0) {
			this.gameState.calls.push({
				playerId: player.id,
				call: callingResult.type,
				cards: cards,
			});
		}

		if (callingResult && callingResult.type === Callings.Belot) {
			const belotColor = cards[0]!.color;

			this.gameState.isGameOver = true;
			this.gameState.gamePhase = GamePhase.Finished;
			const playerTeam = player.teamId === 1 ? this.gameState.team1 : this.gameState.team2;
			this.gameState.winnerTeam = playerTeam;

			this.emit('belotWin', playerId, belotColor);
			this.emit('gameEnded', this.gameState.winnerTeam);
			return;
		}

		this.emit('callMade', playerId, cards, callingResult);

		if (this.gameState.calls.length === 4) {
			this.resolveCalls();
		}
	}

	private resolveCalls(): void {
		const team1Calls = this.gameState.calls.filter((call) => {
			const player = this.gameState.players.find((p) => p.id === call.playerId);
			return player?.teamId === 1;
		});

		const team2Calls = this.gameState.calls.filter((call) => {
			const player = this.gameState.players.find((p) => p.id === call.playerId);
			return player?.teamId === 2;
		});

		const team1HighestCall = getHighestCall(team1Calls);
		const team2HighestCall = getHighestCall(team2Calls);

		let winningCall: CallingsCall | null = null;

		if (!team1HighestCall && !team2HighestCall) winningCall = null;
		else if (!team1HighestCall) winningCall = team2HighestCall;
		else if (!team2HighestCall) winningCall = team1HighestCall;
		else {
			const comparison = compareCallStrength(team1HighestCall, team2HighestCall);
			if (comparison > 0) winningCall = team1HighestCall;
			else if (comparison < 0) winningCall = team2HighestCall;
			else {
				const adutCaller = this.gameState.bids.find((bid) => bid.call === this.gameState.adut)?.playerId;
				const adutCallerTeam = this.gameState.players.find((p) => p.id === adutCaller)?.teamId;

				if (adutCallerTeam === 1) winningCall = team1HighestCall;
				else winningCall = team2HighestCall;
			}
		}

		this.gameState.calls = winningCall ? [winningCall] : [];

		this.emit('callingPhaseEnded', winningCall);
		this.startPlayingPhase();
	}

	private startPlayingPhase(): void {
		this.gameState.gamePhase = GamePhase.Playing;
		this.gameState.currentPlayerIndex = 0;
		this.gameState.currentTrick = {
			cardsPlayed: [],
		};

		this.emit('playingPhaseStarted');
		this.emit('nextPlayerMove', this.getCurrentPlayer());

		const currentPlayer = this.getCurrentPlayer();
		if (currentPlayer.isBot) {
			this.handleBotAction(() => {
				if (this.gameState.adut) {
					const allPlayerCards = [...currentPlayer.cards, ...currentPlayer.talon];
					const botDecision = BotAI.decideCardToPlay(
						{ ...currentPlayer, cards: allPlayerCards },
						this.gameState.currentTrick?.cardsPlayed || [],
						this.gameState.adut,
					);

					this.playCard(currentPlayer.id, botDecision);
				}
			});
		} else {
			this.startTimer(this.options.moveTime, () => {
				const player = this.getCurrentPlayer();
				if (player.cards.length > 0 && this.gameState.adut) {
					const legalCard = findLegalCard(
						this.gameState.currentTrick?.cardsPlayed || [],
						this.gameState.adut,
						player.cards,
					);

					if (legalCard) this.playCard(player.id, legalCard);
				}
			});
		}
	}

	public playCard(playerId: string, card: Card): void {
		const player = this.gameState.players.find((p) => p.id === playerId);
		if (!player) throw new Error(`Player with ID ${playerId} does not exist.`);
		if (this.gameState.gamePhase !== GamePhase.Playing) throw new Error('Not in playing phase.');

		const currentPlayer = this.getCurrentPlayer();
		if (player.id !== currentPlayer.id) throw new Error(`It's not player ${playerId}'s turn.`);

		const allPlayerCards = [...player.cards, ...player.talon];
		const cardIndex = allPlayerCards.findIndex((c) => c.color === card.color && c.type === card.type);
		if (cardIndex === -1) throw new Error('Card not found in player hand.');
		else if (!this.gameState.adut) throw new Error('Adut must be chosen before playing cards.');

		const currentTrick = this.gameState.currentTrick?.cardsPlayed || [];
		if (!canPlayCard(card, currentTrick, this.gameState.adut, allPlayerCards)) {
			throw new Error('This card cannot be played according to Belote rules.');
		}

		this.clearTimer();

		const cardInHandIndex = player.cards.findIndex((c) => c.color === card.color && c.type === card.type);
		const cardInTalonIndex = player.talon.findIndex((c) => c.color === card.color && c.type === card.type);

		if (cardInHandIndex !== -1) {
			player.cards.splice(cardInHandIndex, 1);
		} else if (cardInTalonIndex !== -1) {
			player.talon.splice(cardInTalonIndex, 1);
		}

		this.gameState.currentTrick!.cardsPlayed.push({
			playerId: player.id,
			...card,
		});

		this.emit('cardPlayed', playerId, card);

		if (this.gameState.currentTrick!.cardsPlayed.length === 4) this.completeTrick();
		else {
			this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % 4;
			this.emit('nextPlayerMove', this.getCurrentPlayer());

			const nextPlayer = this.getCurrentPlayer();
			if (nextPlayer.isBot) {
				this.handleBotAction(() => {
					if (this.gameState.adut) {
						const allPlayerCards = [...nextPlayer.cards, ...nextPlayer.talon];
						const botDecision = BotAI.decideCardToPlay(
							{ ...nextPlayer, cards: allPlayerCards },
							this.gameState.currentTrick?.cardsPlayed || [],
							this.gameState.adut,
						);

						this.playCard(nextPlayer.id, botDecision);
					}
				});
			} else {
				this.startTimer(this.options.moveTime, () => {
					const nextPlayer = this.getCurrentPlayer();
					if (nextPlayer.cards.length > 0 && this.gameState.adut) {
						const allPlayerCards = [...nextPlayer.cards, ...nextPlayer.talon];
						const legalCard = findLegalCard(
							this.gameState.currentTrick?.cardsPlayed || [],
							this.gameState.adut,
							allPlayerCards,
						);

						if (legalCard) this.playCard(nextPlayer.id, legalCard);
					}
				});
			}
		}
	}

	private completeTrick(): void {
		const winner = this.determineTrickWinner(this.gameState.currentTrick!);

		this.gameState.currentTrick!.winnerPlayerId = winner.playerId;
		this.gameState.currentTrick!.winningCard = { color: winner.color, type: winner.type };

		const winnerPlayer = this.gameState.players.find((p) => p.id === winner.playerId)!;
		const team = winnerPlayer.teamId === 1 ? this.gameState.team1 : this.gameState.team2;
		team.tricksHistory.push(this.gameState.currentTrick!);

		this.emit('trickCompleted', this.gameState.currentTrick!, winner.playerId);

		const allPlayersEmpty = this.gameState.players.every((p) => p.cards.length === 0 && p.talon.length === 0);

		if (allPlayersEmpty) this.completeRound();
		else {
			this.gameState.currentPlayerIndex = this.gameState.players.findIndex((p) => p.id === winner.playerId);
			this.gameState.currentTrick = { cardsPlayed: [] };

			this.emit('nextTrickStarted', this.getCurrentPlayer());

			const nextPlayer = this.getCurrentPlayer();
			if (nextPlayer.isBot) {
				this.handleBotAction(() => {
					if (this.gameState.adut) {
						const allPlayerCards = [...nextPlayer.cards, ...nextPlayer.talon];
						const botDecision = BotAI.decideCardToPlay(
							{ ...nextPlayer, cards: allPlayerCards },
							this.gameState.currentTrick?.cardsPlayed || [],
							this.gameState.adut,
						);

						this.playCard(nextPlayer.id, botDecision);
					}
				});
			} else {
				this.startTimer(this.options.moveTime, () => {
					const nextPlayer = this.getCurrentPlayer();
					if ((nextPlayer.cards.length > 0 || nextPlayer.talon.length > 0) && this.gameState.adut) {
						const allPlayerCards = [...nextPlayer.cards, ...nextPlayer.talon];
						const legalCard = findLegalCard(
							this.gameState.currentTrick?.cardsPlayed || [],
							this.gameState.adut,
							allPlayerCards,
						);

						if (legalCard) this.playCard(nextPlayer.id, legalCard);
					}
				});
			}
		}
	}

	private determineTrickWinner(trick: Trick): PlayedCard {
		if (!this.gameState.adut) throw new Error('Adut must be set to determine trick winner.');

		let winningCard = trick.cardsPlayed[0]!;

		for (const playedCard of trick.cardsPlayed) {
			if (canBeatCard(playedCard, winningCard, this.gameState.adut)) {
				winningCard = playedCard;
			}
		}

		return winningCard;
	}

	private completeRound(): void {
		const roundScores = this.calculateRoundScores();

		this.gameState.team1.score.push(roundScores.team1);
		this.gameState.team2.score.push(roundScores.team2);

		const winningTeam = roundScores.team1 > roundScores.team2 ? this.gameState.team1 : this.gameState.team2;

		const adutCallerId = this.gameState.bids.find((bid) => bid.call === this.gameState.adut)?.playerId;
		const adutCallerTeam = this.gameState.players.find((p) => p.id === adutCallerId)?.teamId;

		let failedTeam = undefined;
		if (adutCallerTeam === 1 && roundScores.team1 === 0) failedTeam = this.gameState.team1;
		else if (adutCallerTeam === 2 && roundScores.team2 === 0) failedTeam = this.gameState.team2;

		this.emit('roundCompleted', this.gameState.round, roundScores, winningTeam, failedTeam);

		const team1Total = this.gameState.team1.score.reduce((a, b) => a + b, 0);
		const team2Total = this.gameState.team2.score.reduce((a, b) => a + b, 0);

		if (team1Total >= this.options.endValue || team2Total >= this.options.endValue) {
			this.gameState.isGameOver = true;
			this.gameState.gamePhase = GamePhase.Finished;
			this.gameState.winnerTeam = team1Total > team2Total ? this.gameState.team1 : this.gameState.team2;

			this.emit('gameEnded', this.gameState.winnerTeam);
		} else {
			this.startNextRound();
		}
	}

	private calculateRoundScores(): { team1: number; team2: number } {
		let team1Points = 0;
		let team2Points = 0;

		for (const team of [this.gameState.team1, this.gameState.team2]) {
			let teamPoints = 0;

			for (const trick of team.tricksHistory) {
				for (const card of trick.cardsPlayed) {
					teamPoints += getCardValue(card, this.gameState.adut!);
				}
			}

			if (team.tricksHistory.length > 0) {
				const lastTrick = team.tricksHistory[team.tricksHistory.length - 1]!;
				const lastOverallTrick = this.getLastTrickOverall();

				if (lastOverallTrick && this.areTricksEqual(lastTrick, lastOverallTrick)) {
					teamPoints += 20;
				}
			}

			if (team.tricksHistory.length === 8) {
				teamPoints += 90;
			}

			if (team.id === 1) team1Points = teamPoints;
			else team2Points = teamPoints;
		}

		const callingPoints = this.gameState.calls.reduce((sum, call) => sum + call.call, 0);
		const totalGamePoints = 162 + callingPoints;
		const passingScore = Math.floor(totalGamePoints / 2) + 1;

		const adutCallerId = this.gameState.bids.find((bid) => bid.call === this.gameState.adut)?.playerId;
		const adutCallerTeam = this.gameState.players.find((p) => p.id === adutCallerId)?.teamId;

		switch (adutCallerTeam) {
			case 1: {
				if (team1Points >= passingScore) team1Points += callingPoints;
				else {
					team2Points = totalGamePoints;
					team1Points = 0;
				}

				break;
			}
			case 2: {
				if (team2Points >= passingScore) team2Points += callingPoints;
				else {
					team1Points = totalGamePoints;
					team2Points = 0;
				}

				break;
			}
			default: {
				team1Points += callingPoints;
				team2Points += callingPoints;
				break;
			}
		}

		return { team1: team1Points, team2: team2Points };
	}

	private getLastTrickOverall(): Trick | null {
		const allTricks = [...this.gameState.team1.tricksHistory, ...this.gameState.team2.tricksHistory];
		return allTricks.length > 0 ? allTricks[allTricks.length - 1]! : null;
	}

	private areTricksEqual(trick1: Trick, trick2: Trick): boolean {
		for (let i = 0; i < trick1.cardsPlayed.length; i++) {
			const card1 = trick1.cardsPlayed[i]!;
			const card2 = trick2.cardsPlayed[i]!;

			if (card1.playerId !== card2.playerId || card1.color !== card2.color || card1.type !== card2.type) {
				return false;
			}
		}

		return true;
	}

	public getPlayerById(playerId: string): Player | null {
		return this.gameState.players.find((p) => p.id === playerId) || null;
	}

	public getPlayersByTeam(teamId: number): Player[] {
		return this.gameState.players.filter((p) => p.teamId === teamId);
	}

	public destroy(): void {
		this.clearTimer();
		this.removeAllListeners();
	}
}

// Declarations.
export interface Belote {
	on<K extends keyof BeloteEvents>(event: K, listener: BeloteEvents[K]): this;
	emit<K extends keyof BeloteEvents>(event: K, ...args: Parameters<BeloteEvents[K]>): boolean;
	off<K extends keyof BeloteEvents>(event: K, listener: BeloteEvents[K]): this;
	removeAllListeners<K extends keyof BeloteEvents>(event?: K): this;
	addListener<K extends keyof BeloteEvents>(event: K, listener: BeloteEvents[K]): this;
	once<K extends keyof BeloteEvents>(event: K, listener: BeloteEvents[K]): this;
}
