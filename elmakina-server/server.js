const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

// Configuration Socket.io pour la production
const io = new Server(server, { 
    cors: { 
        origin: "*", // Permet à ton frontend Vercel de se connecter
        methods: ["GET", "POST"] 
    } 
});

const CHARACTERS = [ 'homme_daffaires', 'politicien', 'terroriste', 'voleur', 'colonel', 'percepteur', 'policier' ];
let gameState = { roomId: "elmakina_main", status: "waiting", players: [], bankCoins: 0, deck: [], currentTurnIndex: 0, pendingAction: null, pendingDiscard: null, pendingExchange: null, pendingPoliceDecision: null, winner: null };

function createDeck() {
  let newDeck = [];
  CHARACTERS.forEach(c => newDeck.push(c, c, c));
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

function emitSecureStateToAll() {
    gameState.players.forEach(player => {
        const stateForPlayer = { 
            ...gameState, 
            players: gameState.players.map(p => ({ ...p, cards: p.id === player.id ? p.cards : p.cards.length })),
            pendingExchange: gameState.pendingExchange ? {
                playerId: gameState.pendingExchange.playerId,
                playerName: gameState.pendingExchange.playerName,
                drawnCards: gameState.pendingExchange.playerId === player.id ? gameState.pendingExchange.drawnCards : []
            } : null,
            pendingPoliceDecision: gameState.pendingPoliceDecision ? {
                policeId: gameState.pendingPoliceDecision.policeId,
                policeName: gameState.pendingPoliceDecision.policeName,
                targetId: gameState.pendingPoliceDecision.targetId,
                targetName: gameState.pendingPoliceDecision.targetName,
                cardValue: gameState.pendingPoliceDecision.policeId === player.id ? gameState.pendingPoliceDecision.cardValue : null
            } : null
        };
        io.to(player.id).emit('update_state', stateForPlayer);
    });
}

function checkWinCondition() {
    if (gameState.status !== 'playing') return false;
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    if (alivePlayers.length === 1) {
        gameState.status = 'game_over';
        gameState.winner = alivePlayers[0];
        return true;
    } else if (alivePlayers.length === 0) {
        gameState.status = 'game_over';
        gameState.winner = null;
        return true;
    }
    return false;
}

function passerAuProchainJoueur() {
    if (gameState.status !== 'playing') return;
    let loopCount = 0;
    do {
        gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.players.length;
        loopCount++;
        if (loopCount > gameState.players.length) break; 
    } while (!gameState.players[gameState.currentTurnIndex].isAlive);
}

function setActionLog(playerId, text) {
    const p = gameState.players.find(x => x.id === playerId);
    if (p) p.lastAction = text;
}

function createPendingAction(type, claimer, opts = {}) {
    return {
        type,
        playerClaiming: claimer,
        hasPassed: [claimer.id],
        requiredPasses: gameState.players.filter(p => p.isAlive).length,
        ...opts
    };
}

function executeAction(action) {
    if (!action) return false;
    const claimer = gameState.players.find(p => p.id === action.playerClaiming.id);
    
    if (action.type === 'foreign_aid') {
        const spaceLeft = 12 - claimer.coins;
        const coinsToTake = Math.min(2, spaceLeft);
        claimer.coins += coinsToTake;
        gameState.bankCoins -= coinsToTake;
        setActionLog(claimer.id, "A pris l'aide (+2)");
        return false;
    } else if (action.role === 'homme_daffaires') {
        const spaceLeft = 12 - claimer.coins;
        const coinsToTake = Math.min(4, spaceLeft);
        claimer.coins += coinsToTake;
        gameState.bankCoins -= coinsToTake;
        setActionLog(claimer.id, "A pris le business (+4)");
        return false;
    } else if (action.role === 'voleur') {
        const targetPlayer = gameState.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive) {
            const spaceLeft = 12 - claimer.coins;
            const stealAmount = Math.min(2, targetPlayer.coins);
            const actualGain = Math.min(stealAmount, spaceLeft);
            targetPlayer.coins -= stealAmount;
            claimer.coins += actualGain;
            if (stealAmount > actualGain) gameState.bankCoins += (stealAmount - actualGain);
            setActionLog(claimer.id, `A volé ${targetPlayer.name}`);
        }
        return false;
    } else if (action.role === 'terroriste') {
        claimer.coins -= 3;
        gameState.bankCoins += 3;
        const targetPlayer = gameState.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive) {
            setActionLog(claimer.id, `A frappé ${targetPlayer.name}`);
            gameState.pendingDiscard = { playerId: targetPlayer.id, playerName: targetPlayer.name, wasLying: false, resumeAction: null };
            return true; 
        }
    } else if (action.role === 'politicien') {
        const drawn = gameState.deck.splice(0, 2);
        setActionLog(claimer.id, "Échange ses cartes");
        gameState.pendingExchange = { playerId: claimer.id, playerName: claimer.name, drawnCards: drawn };
        return true; 
    } else if (action.type === 'colonel_guess') {
        const targetPlayer = gameState.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive) {
            const hasCard = targetPlayer.cards.includes(action.guessedRole);
            if (hasCard) {
                const penalty = Math.min(4, targetPlayer.coins);
                targetPlayer.coins -= penalty;
                gameState.bankCoins += penalty;
                const cardIndex = targetPlayer.cards.indexOf(action.guessedRole);
                if (cardIndex !== -1) {
                    const removedCard = targetPlayer.cards.splice(cardIndex, 1)[0];
                    gameState.deck.push(removedCard);
                    for (let i = gameState.deck.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
                    }
                    setActionLog(claimer.id, `A eu raison sur ${targetPlayer.name} !`);
                    if (targetPlayer.cards.length === 0) {
                        targetPlayer.isAlive = false;
                        checkWinCondition();
                    }
                }
            } else {
                const penalty = Math.min(4, claimer.coins);
                claimer.coins -= penalty;
                gameState.bankCoins += penalty;
                setActionLog(claimer.id, `S'est trompé sur ${targetPlayer.name}`);
            }
        }
        return false;
    } else if (action.type === 'police_inspect') {
        const targetPlayer = gameState.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive && targetPlayer.cards.length > 0) {
            const cardIndex = Math.floor(Math.random() * targetPlayer.cards.length);
            const cardValue = targetPlayer.cards[cardIndex];
            gameState.pendingPoliceDecision = {
                policeId: claimer.id,
                policeName: claimer.name,
                targetId: targetPlayer.id,
                targetName: targetPlayer.name,
                cardIndex: cardIndex,
                cardValue: cardValue
            };
            setActionLog(claimer.id, `Fouille ${targetPlayer.name}`);
            return true; 
        }
        return false;
    } else if (action.role === 'percepteur') {
        let totalTax = 0;
        gameState.players.forEach(p => {
            if (p.id !== claimer.id && p.isAlive && p.coins >= 7) {
                p.coins -= 1;
                totalTax += 1;
            }
        });
        const spaceLeft = 12 - claimer.coins;
        const actualGain = Math.min(totalTax, spaceLeft);
        claimer.coins += actualGain;
        if (totalTax > actualGain) gameState.bankCoins += (totalTax - actualGain);
        setActionLog(claimer.id, "A prélevé la taxe");
        return false;
    }
    return false;
}

io.on('connection', (socket) => {
  socket.on('join_table', (playerName) => {
    if (gameState.status === 'playing' || gameState.status === 'game_over') return;
    gameState.players.push({ id: socket.id, name: playerName, coins: 2, cards: [], isAlive: true, lastAction: "A rejoint la table" });
    socket.join(gameState.roomId);
    io.to(gameState.roomId).emit('update_state', gameState);
  });

  socket.on('return_to_lobby', () => {
    if (gameState.status === 'game_over') {
        gameState.status = 'waiting';
        gameState.winner = null;
        gameState.pendingAction = null;
        gameState.pendingDiscard = null;
        gameState.pendingExchange = null;
        gameState.pendingPoliceDecision = null;
        gameState.players.forEach(p => {
            p.coins = 2;
            p.cards = [];
            p.isAlive = true;
            p.lastAction = "Prêt pour la revanche";
        });
        emitSecureStateToAll();
    }
  });

  socket.on('start_game', () => {
    if (gameState.players.length < 3) return;
    gameState.status = 'playing';
    gameState.deck = createDeck();
    gameState.bankCoins = 50;
    const cardsPerPlayer = (gameState.players.length <= 4) ? 3 : 2;
    gameState.players.forEach(p => {
        p.cards = gameState.deck.splice(0, cardsPerPlayer);
        p.lastAction = "La partie commence";
    });
    emitSecureStateToAll();
  });

  socket.on('take_salary', () => {
    const player = gameState.players.find(p => p.id === socket.id);
    const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === socket.id;
    if (isMyTurn && player.isAlive && gameState.bankCoins >= 1 && player.coins < 12) {
        player.coins += 1;
        gameState.bankCoins -= 1;
        setActionLog(player.id, "A pris 1 شهريّة");
        passerAuProchainJoueur();
        emitSecureStateToAll(); 
    }
  });

  socket.on('foreign_aid', () => {
    const player = gameState.players.find(p => p.id === socket.id);
    const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === socket.id;
    if (!isMyTurn || !player.isAlive || gameState.pendingAction) return;
    gameState.pendingAction = createPendingAction('foreign_aid', player);
    setActionLog(player.id, "Demande l'aide (+2)");
    emitSecureStateToAll();
  });

  socket.on('claim_role', (data) => {
    const player = gameState.players.find(p => p.id === socket.id);
    const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === socket.id;
    if (!isMyTurn || !player.isAlive || gameState.pendingAction) return;
    const roleName = data.role.replace('_', ' ');
    if(data.targetId) {
        const target = gameState.players.find(p => p.id === data.targetId);
        setActionLog(player.id, `Joue ${roleName} sur ${target.name}`);
    } else {
        setActionLog(player.id, `Joue ${roleName}`);
    }
    gameState.pendingAction = createPendingAction('role_claim', player, { role: data.role, targetId: data.targetId || null });
    emitSecureStateToAll();
  });

  socket.on('colonel_guess', (data) => {
    const player = gameState.players.find(p => p.id === socket.id);
    const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === socket.id;
    if (!isMyTurn || !player.isAlive || player.coins < 4 || gameState.pendingAction) return;
    const target = gameState.players.find(p => p.id === data.targetId);
    setActionLog(player.id, `Vise ${target.name} (Colonel)`);
    gameState.pendingAction = createPendingAction('colonel_guess', player, { targetId: data.targetId, guessedRole: data.guessedRole });
    emitSecureStateToAll();
  });

  socket.on('police_inspect', (targetId) => {
    const player = gameState.players.find(p => p.id === socket.id);
    const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === socket.id;
    if (!isMyTurn || !player.isAlive || gameState.pendingAction) return;
    const target = gameState.players.find(p => p.id === targetId);
    setActionLog(player.id, `Inspecte ${target.name} (Police)`);
    gameState.pendingAction = createPendingAction('police_inspect', player, { targetId });
    emitSecureStateToAll();
  });

  socket.on('block_action', (blockRole) => {
    if (!gameState.pendingAction) return;
    const blocker = gameState.players.find(p => p.id === socket.id);
    if (!blocker.isAlive) return;
    setActionLog(blocker.id, `Bloque avec ${blockRole}`);
    gameState.pendingAction = createPendingAction('block', blocker, { role: blockRole, originalAction: gameState.pendingAction });
    emitSecureStateToAll();
  });

  socket.on('tax_businessman', () => {
    const taxer = gameState.players.find(p => p.id === socket.id);
    if (!taxer.isAlive) return;
    setActionLog(taxer.id, "Taxe !");
    if (gameState.pendingAction && gameState.pendingAction.role === 'homme_daffaires' && gameState.pendingAction.type === 'role_claim') {
        gameState.pendingAction = createPendingAction('tax_businessman', taxer, { role: 'percepteur', taxers: [taxer], originalAction: gameState.pendingAction });
    } else if (gameState.pendingAction && gameState.pendingAction.type === 'tax_businessman') {
        if (!gameState.pendingAction.taxers.some(t => t.id === taxer.id) && gameState.pendingAction.taxers.length < 3) {
            gameState.pendingAction.taxers.push(taxer);
            if (!gameState.pendingAction.hasPassed.includes(socket.id)) gameState.pendingAction.hasPassed.push(socket.id); 
        }
    }
    emitSecureStateToAll();
  });

  socket.on('coup_detat', (targetId) => {
    const player = gameState.players.find(p => p.id === socket.id);
    const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === socket.id;
    if (!isMyTurn || !player.isAlive || player.coins < 7 || gameState.pendingAction) return;
    const target = gameState.players.find(p => p.id === targetId);
    setActionLog(player.id, `Coup d'État sur ${target.name} !`);
    player.coins -= 7;
    gameState.bankCoins += 7;
    gameState.pendingAction = createPendingAction('coup_detat', player, { targetId });
    emitSecureStateToAll();
  });

  socket.on('rachwa', () => {
    if (!gameState.pendingAction || gameState.pendingAction.type !== 'coup_detat') return;
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player.isAlive || player.coins < 9) return;
    setActionLog(player.id, "Paie une Rachwa (-9)");
    player.coins -= 9;
    gameState.bankCoins += 9;
    gameState.pendingAction = null;
    passerAuProchainJoueur();
    emitSecureStateToAll();
  });

  socket.on('pass_action', () => {
    if (!gameState.pendingAction) return;
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player.isAlive || gameState.pendingAction.hasPassed.includes(socket.id)) return;
    gameState.pendingAction.hasPassed.push(socket.id);
    setActionLog(player.id, "A passé");
    if (gameState.pendingAction.hasPassed.length >= gameState.pendingAction.requiredPasses) {
        let requiresDiscardPause = false;
        if (gameState.pendingAction.type === 'block') {
            requiresDiscardPause = false;
        } else if (gameState.pendingAction.type === 'coup_detat') {
            const targetPlayer = gameState.players.find(p => p.id === gameState.pendingAction.targetId);
            if (targetPlayer && targetPlayer.isAlive) {
                gameState.pendingDiscard = { playerId: targetPlayer.id, playerName: targetPlayer.name, wasLying: false, resumeAction: null };
                requiresDiscardPause = true;
            }
        } else if (gameState.pendingAction.type === 'tax_businessman') {
            const taxers = gameState.pendingAction.taxers;
            const businessman = gameState.pendingAction.originalAction.playerClaiming;
            const targetBM = gameState.players.find(p => p.id === businessman.id);
            if (targetBM && targetBM.isAlive) {
                const spaceLeftBM = 12 - targetBM.coins;
                const coinsToTakeBM = Math.min(Math.max(0, 4 - taxers.length), spaceLeftBM);
                targetBM.coins += coinsToTakeBM;
                gameState.bankCoins -= coinsToTakeBM;
            }
            taxers.forEach(t => {
                const targetTaxer = gameState.players.find(p => p.id === t.id);
                if (targetTaxer && targetTaxer.isAlive && targetTaxer.coins < 12) {
                    targetTaxer.coins += 1;
                    gameState.bankCoins -= 1;
                }
            });
            requiresDiscardPause = false;
        } else {
            requiresDiscardPause = executeAction(gameState.pendingAction); 
        }
        gameState.pendingAction = null;
        if (!requiresDiscardPause) passerAuProchainJoueur();
    }
    emitSecureStateToAll();
  });

  socket.on('challenge_taxer', (taxerId) => {
    if (!gameState.pendingAction || gameState.pendingAction.type !== 'tax_businessman') return;
    const challenger = gameState.players.find(p => p.id === socket.id);
    const taxerPlayer = gameState.players.find(p => p.id === taxerId);
    if (!challenger || !challenger.isAlive || !taxerPlayer || !taxerPlayer.isAlive) return;
    setActionLog(challenger.id, `Tchalenji ${taxerPlayer.name} !`);
    const hasCard = taxerPlayer.cards.includes('percepteur');
    let loser;
    if (hasCard) loser = challenger; 
    else {
        loser = taxerPlayer; 
        gameState.pendingAction.taxers = gameState.pendingAction.taxers.filter(t => t.id !== taxerId);
    }
    gameState.pendingDiscard = { playerId: loser.id, playerName: loser.name, wasLying: !hasCard, resumeAction: gameState.pendingAction };
    gameState.pendingAction = null; 
    emitSecureStateToAll();
  });

  socket.on('challenge_action', () => {
    if (!gameState.pendingAction) return;
    const action = gameState.pendingAction;
    const challenger = gameState.players.find(p => p.id === socket.id);
    if (!challenger.isAlive) return; 
    setActionLog(challenger.id, "Tchalenji !");
    const claimer = gameState.players.find(p => p.id === action.playerClaiming.id);
    let roleToCheck = action.role;
    if (action.type === 'colonel_guess') roleToCheck = 'colonel';
    if (action.type === 'police_inspect') roleToCheck = 'policier';
    const hasCard = claimer.cards.includes(roleToCheck);
    let loser;
    if (hasCard) {
        loser = challenger;
        if (action.type === 'role_claim' || action.type === 'colonel_guess' || action.type === 'police_inspect') executeAction(action);
    } else {
        loser = claimer;
        if (action.type === 'block') executeAction(action.originalAction);
    }
    gameState.pendingAction = null;
    gameState.pendingDiscard = { playerId: loser.id, playerName: loser.name, wasLying: !hasCard, resumeAction: null };
    emitSecureStateToAll();
  });

  socket.on('discard_card', (cardIndex) => {
    if (!gameState.pendingDiscard || gameState.pendingDiscard.playerId !== socket.id) return;
    const player = gameState.players.find(p => p.id === socket.id);
    player.cards.splice(cardIndex, 1);
    if (player.cards.length === 0) player.isAlive = false;
    setActionLog(player.id, "A sacrifié une carte");
    const isGameOver = checkWinCondition();
    if (!isGameOver) {
        if (gameState.pendingDiscard.resumeAction) {
            gameState.pendingAction = gameState.pendingDiscard.resumeAction;
            if (gameState.pendingAction.type === 'tax_businessman' && gameState.pendingAction.taxers.length === 0) {
                 executeAction(gameState.pendingAction.originalAction);
                 gameState.pendingAction = null;
                 passerAuProchainJoueur();
            }
        } else passerAuProchainJoueur();
    }
    gameState.pendingDiscard = null;
    emitSecureStateToAll();
  });

  socket.on('exchange_cards', (keptCards, returnedCards) => {
    if (!gameState.pendingExchange || gameState.pendingExchange.playerId !== socket.id) return;
    const player = gameState.players.find(p => p.id === socket.id);
    player.cards = keptCards; 
    gameState.deck.push(...returnedCards); 
    for (let i = gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
    }
    setActionLog(player.id, "A validé l'échange");
    gameState.pendingExchange = null;
    passerAuProchainJoueur();
    emitSecureStateToAll();
  });

  socket.on('police_decision', (decision) => {
    if (!gameState.pendingPoliceDecision || gameState.pendingPoliceDecision.policeId !== socket.id) return;
    const targetPlayer = gameState.players.find(p => p.id === gameState.pendingPoliceDecision.targetId);
    if (targetPlayer && targetPlayer.isAlive && decision === 'change') {
        const cardIndex = gameState.pendingPoliceDecision.cardIndex;
        const oldCard = targetPlayer.cards.splice(cardIndex, 1)[0];
        const newCard = gameState.deck.shift();
        targetPlayer.cards.push(newCard);
        gameState.deck.push(oldCard);
        for (let i = gameState.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
        }
        setActionLog(socket.id, `A fait changer la carte de ${targetPlayer.name}`);
    } else setActionLog(socket.id, `A laissé la carte de ${targetPlayer.name}`);
    gameState.pendingPoliceDecision = null;
    passerAuProchainJoueur();
    emitSecureStateToAll();
  });

  socket.on('disconnect', () => {
    gameState.players = gameState.players.filter(p => p.id !== socket.id);
    checkWinCondition(); 
    io.to(gameState.roomId).emit('update_state', gameState);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Le serveur ElMakina tourne sur le port ${PORT}`));