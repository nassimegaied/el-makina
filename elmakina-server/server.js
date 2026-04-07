const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
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

function broadcastReveal(playerName, textObj, cards) {
    gameState.players.forEach(p => {
        io.to(p.id).emit('public_reveal', { playerName, text: textObj, cards });
    });
}

function swapCard(player, oldCard) {
    const index = player.cards.indexOf(oldCard);
    if (index !== -1) {
        player.cards.splice(index, 1);
        broadcastReveal(player.name, { fr: "A prouvé son rôle et recycle son :", en: "Proved role and recycled:" }, [oldCard]);
        gameState.deck.push(oldCard);
        for (let i = gameState.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
        }
        player.cards.push(gameState.deck.shift());
    }
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

function setActionLog(playerId, textObj) {
    const p = gameState.players.find(x => x.id === playerId);
    if (p) p.lastAction = textObj;
}

function createPendingAction(type, claimer, opts = {}) {
    return { type, playerClaiming: claimer, hasPassed: [claimer.id], requiredPasses: gameState.players.filter(p => p.isAlive).length, ...opts };
}

function getRoleName(role, lang) {
    const map = { homme_daffaires: {fr:"Business", en:"Business"}, politicien: {fr:"Politicien", en:"Politician"}, terroriste: {fr:"Terroriste", en:"Terrorist"}, voleur: {fr:"Voleur", en:"Thief"}, colonel: {fr:"Colonel", en:"Colonel"}, percepteur: {fr:"Percepteur", en:"Tax Collector"}, policier: {fr:"Police", en:"Police"} };
    return map[role] ? map[role][lang] : role;
}

function executeAction(action) {
    if (!action) return false;
    const claimer = gameState.players.find(p => p.id === action.playerClaiming.id);
    
    if (action.type === 'foreign_aid') {
        const spaceLeft = 12 - claimer.coins;
        claimer.coins += Math.min(2, spaceLeft);
        gameState.bankCoins -= Math.min(2, spaceLeft);
        setActionLog(claimer.id, { fr: "A pris l'aide (+2)", en: "Took Foreign Aid (+2)" });
        return false;
    } else if (action.role === 'homme_daffaires') {
        const spaceLeft = 12 - claimer.coins;
        claimer.coins += Math.min(4, spaceLeft);
        gameState.bankCoins -= Math.min(4, spaceLeft);
        setActionLog(claimer.id, { fr: "A pris le business (+4)", en: "Took Business (+4)" });
        return false;
    } else if (action.role === 'voleur') {
        const targetPlayer = gameState.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive) {
            const stealAmount = Math.min(2, targetPlayer.coins);
            targetPlayer.coins -= stealAmount;
            claimer.coins = Math.min(12, claimer.coins + stealAmount);
            setActionLog(claimer.id, { fr: `A volé ${targetPlayer.name}`, en: `Stole from ${targetPlayer.name}` });
        }
        return false;
    } else if (action.role === 'terroriste') {
        claimer.coins -= 3;
        gameState.bankCoins += 3;
        const targetPlayer = gameState.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive) {
            setActionLog(claimer.id, { fr: `A frappé ${targetPlayer.name}`, en: `Targeted ${targetPlayer.name}` });
            gameState.pendingDiscard = { playerId: targetPlayer.id, playerName: targetPlayer.name, wasLying: false, resumeAction: null };
            return true; 
        }
    } else if (action.role === 'politicien') {
        const drawn = gameState.deck.splice(0, 2);
        setActionLog(claimer.id, { fr: "Échange ses cartes", en: "Exchanging cards" });
        gameState.pendingExchange = { playerId: claimer.id, playerName: claimer.name, drawnCards: drawn };
        return true; 
    } else if (action.type === 'colonel_guess') {
        claimer.coins -= 4;
        gameState.bankCoins += 4;
        const targetPlayer = gameState.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive) {
            const hasCard = targetPlayer.cards.includes(action.guessedRole);
            if (hasCard) {
                const cardIndex = targetPlayer.cards.indexOf(action.guessedRole);
                const removedCard = targetPlayer.cards.splice(cardIndex, 1)[0];
                broadcastReveal(targetPlayer.name, { fr: "S'est fait exploser son :", en: "Got their card destroyed:" }, [removedCard]);
                gameState.deck.push(removedCard);
                for (let i = gameState.deck.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
                }
                setActionLog(claimer.id, { fr: `A eu raison sur ${targetPlayer.name} !`, en: `Guessed correctly on ${targetPlayer.name} !` });
                if (targetPlayer.cards.length === 0) {
                    targetPlayer.isAlive = false;
                    checkWinCondition();
                }
            } else {
                setActionLog(claimer.id, { fr: `S'est trompé sur ${targetPlayer.name}`, en: `Guessed wrong on ${targetPlayer.name}` });
            }
        }
        return false;
    } else if (action.type === 'police_inspect') {
        const targetPlayer = gameState.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive && targetPlayer.cards.length > 0) {
            const cardIndex = Math.floor(Math.random() * targetPlayer.cards.length);
            const cardValue = targetPlayer.cards[cardIndex];
            gameState.pendingPoliceDecision = {
                policeId: claimer.id, policeName: claimer.name,
                targetId: targetPlayer.id, targetName: targetPlayer.name,
                cardIndex: cardIndex, cardValue: cardValue
            };
            setActionLog(claimer.id, { fr: `Fouille ${targetPlayer.name}`, en: `Inspecting ${targetPlayer.name}` });
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
        claimer.coins = Math.min(12, claimer.coins + totalTax);
        setActionLog(claimer.id, { fr: "A prélevé la taxe", en: "Collected tax" });
        return false;
    }
    return false;
}

io.on('connection', (socket) => {
  socket.on('join_table', (playerName) => {
    if (gameState.status === 'playing' || gameState.status === 'game_over') return;
    gameState.players.push({ id: socket.id, name: playerName, coins: 2, cards: [], isAlive: true, lastAction: { fr: "A rejoint", en: "Joined" } });
    socket.join(gameState.roomId);
    io.to(gameState.roomId).emit('update_state', gameState);
  });

  socket.on('return_to_lobby', () => {
    if (gameState.status === 'game_over') {
        gameState.status = 'waiting';
        gameState.winner = null;
        gameState.players.forEach(p => { p.coins = 2; p.cards = []; p.isAlive = true; p.lastAction = { fr: "Prêt", en: "Ready" }; });
        emitSecureStateToAll();
    }
  });

  socket.on('start_game', () => {
    if (gameState.players.length < 3) return;
    gameState.status = 'playing';
    gameState.deck = createDeck();
    gameState.bankCoins = 50;
    const cardsPerPlayer = (gameState.players.length <= 4) ? 3 : 2;
    gameState.players.forEach(p => { p.cards = gameState.deck.splice(0, cardsPerPlayer); p.lastAction = { fr: "La partie commence", en: "Game Started" }; });
    emitSecureStateToAll();
  });

  socket.on('take_salary', () => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (gameState.players[gameState.currentTurnIndex]?.id === socket.id && player.isAlive) {
        player.coins = Math.min(12, player.coins + 1);
        gameState.bankCoins -= 1;
        setActionLog(player.id, { fr: "A pris 1 Salaire", en: "Took 1 Income" });
        passerAuProchainJoueur();
        emitSecureStateToAll(); 
    }
  });

  socket.on('foreign_aid', () => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (gameState.players[gameState.currentTurnIndex]?.id === socket.id && player.isAlive) {
        gameState.pendingAction = createPendingAction('foreign_aid', player);
        setActionLog(player.id, { fr: "Demande l'aide", en: "Asks for Aid" });
        emitSecureStateToAll();
    }
  });

  socket.on('claim_role', (data) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (gameState.players[gameState.currentTurnIndex]?.id === socket.id && player.isAlive) {
        gameState.pendingAction = createPendingAction('role_claim', player, { role: data.role, targetId: data.targetId || null });
        setActionLog(player.id, { fr: `Joue ${getRoleName(data.role, 'fr')}`, en: `Plays ${getRoleName(data.role, 'en')}` });
        emitSecureStateToAll();
    }
  });

  socket.on('colonel_guess', (data) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (gameState.players[gameState.currentTurnIndex]?.id === socket.id && player.isAlive && player.coins >= 4) {
        gameState.pendingAction = createPendingAction('colonel_guess', player, { targetId: data.targetId, guessedRole: data.guessedRole });
        setActionLog(player.id, { fr: "Pari du Colonel", en: "Colonel's Guess" });
        emitSecureStateToAll();
    }
  });

  socket.on('police_inspect', (targetId) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (gameState.players[gameState.currentTurnIndex]?.id === socket.id && player.isAlive) {
        gameState.pendingAction = createPendingAction('police_inspect', player, { targetId });
        setActionLog(player.id, { fr: "Interrogatoire", en: "Interrogation" });
        emitSecureStateToAll();
    }
  });

  socket.on('block_action', (blockRole) => {
    const blocker = gameState.players.find(p => p.id === socket.id);
    if (blocker && blocker.isAlive && gameState.pendingAction) {
        setActionLog(blocker.id, { fr: `Bloque (${getRoleName(blockRole, 'fr')})`, en: `Blocks (${getRoleName(blockRole, 'en')})` });
        gameState.pendingAction = createPendingAction('block', blocker, { role: blockRole, originalAction: gameState.pendingAction });
        emitSecureStateToAll();
    }
  });

  socket.on('tax_businessman', () => {
    const taxer = gameState.players.find(p => p.id === socket.id);
    if (taxer && taxer.isAlive && gameState.pendingAction?.role === 'homme_daffaires') {
        if (gameState.pendingAction.type === 'role_claim') {
            gameState.pendingAction = createPendingAction('tax_businessman', taxer, { role: 'percepteur', taxers: [taxer], originalAction: gameState.pendingAction });
        } else if (gameState.pendingAction.type === 'tax_businessman' && gameState.pendingAction.taxers.length < 3) {
            gameState.pendingAction.taxers.push(taxer);
        }
        setActionLog(taxer.id, { fr: "Taxe !", en: "Taxes!" });
        emitSecureStateToAll();
    }
  });

  socket.on('coup_detat', (targetId) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (gameState.players[gameState.currentTurnIndex]?.id === socket.id && player.isAlive && player.coins >= 7) {
        player.coins -= 7;
        gameState.bankCoins += 7;
        gameState.pendingAction = createPendingAction('coup_detat', player, { targetId });
        setActionLog(player.id, { fr: "Coup d'État !", en: "Coup d'État !" });
        emitSecureStateToAll();
    }
  });

  socket.on('rachwa', () => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (player && player.isAlive && player.coins >= 9 && gameState.pendingAction?.type === 'coup_detat') {
        player.coins -= 9;
        gameState.bankCoins += 9;
        gameState.pendingAction = null;
        setActionLog(player.id, { fr: "Rachwa (Pot-de-vin) !", en: "Paid a bribe!" });
        passerAuProchainJoueur();
        emitSecureStateToAll();
    }
  });

  socket.on('pass_action', () => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive || !gameState.pendingAction || gameState.pendingAction.hasPassed.includes(socket.id)) return;

    gameState.pendingAction.hasPassed.push(socket.id);
    setActionLog(player.id, { fr: "Passe", en: "Passes" });

    if (gameState.pendingAction.hasPassed.length >= gameState.pendingAction.requiredPasses) {
        let needsPause = false;
        if (gameState.pendingAction.type === 'block') {
            needsPause = false;
        } else if (gameState.pendingAction.type === 'coup_detat') {
            const target = gameState.players.find(p => p.id === gameState.pendingAction.targetId);
            gameState.pendingDiscard = { playerId: target.id, playerName: target.name, wasLying: false, resumeAction: null };
            needsPause = true;
        } else if (gameState.pendingAction.type === 'tax_businessman') {
            const taxers = gameState.pendingAction.taxers;
            const businessman = gameState.players.find(p => p.id === gameState.pendingAction.originalAction.playerClaiming.id);
            businessman.coins = Math.min(12, businessman.coins + Math.max(0, 4 - taxers.length));
            taxers.forEach(t => {
                const p = gameState.players.find(x => x.id === t.id);
                p.coins = Math.min(12, p.coins + 1);
            });
            needsPause = false;
        } else {
            needsPause = executeAction(gameState.pendingAction);
        }
        gameState.pendingAction = null;
        if (!needsPause) passerAuProchainJoueur();
    }
    emitSecureStateToAll();
  });

  socket.on('challenge_taxer', (taxerId) => {
    const challenger = gameState.players.find(p => p.id === socket.id);
    const taxer = gameState.players.find(p => p.id === taxerId);
    if (!challenger || !taxer || !gameState.pendingAction) return;
    const hasCard = taxer.cards.includes('percepteur');
    let loser;
    if (hasCard) { loser = challenger; swapCard(taxer, 'percepteur'); } 
    else { loser = taxer; gameState.pendingAction.taxers = gameState.pendingAction.taxers.filter(t => t.id !== taxerId); }
    gameState.pendingDiscard = { playerId: loser.id, playerName: loser.name, wasLying: !hasCard, resumeAction: gameState.pendingAction };
    gameState.pendingAction = null;
    emitSecureStateToAll();
  });

  socket.on('challenge_action', () => {
    const challenger = gameState.players.find(p => p.id === socket.id);
    if (!challenger || !challenger.isAlive || !gameState.pendingAction) return;

    const action = gameState.pendingAction;
    const claimer = gameState.players.find(p => p.id === action.playerClaiming.id);
    let roleToCheck = action.role;
    if (action.type === 'colonel_guess') roleToCheck = 'colonel';
    if (action.type === 'police_inspect') roleToCheck = 'policier';

    const hasCard = claimer.cards.includes(roleToCheck);
    let loser;

    if (hasCard) {
        loser = challenger;
        swapCard(claimer, roleToCheck);
        if (['role_claim', 'colonel_guess', 'police_inspect'].includes(action.type)) executeAction(action);
    } else {
        loser = claimer;
        if (action.type === 'block') executeAction(action.originalAction);
    }

    gameState.pendingAction = null;
    gameState.pendingDiscard = { playerId: loser.id, playerName: loser.name, wasLying: !hasCard, resumeAction: null };
    emitSecureStateToAll();
  });

  socket.on('discard_card', (cardIndex) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || !gameState.pendingDiscard || gameState.pendingDiscard.playerId !== socket.id) return;
    const deadCard = player.cards.splice(cardIndex, 1)[0];
    
    broadcastReveal(player.name, { fr: "A perdu la carte :", en: "Lost the card:" }, [deadCard]);

    gameState.deck.push(deadCard);
    for (let i = gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
    }
    if (player.cards.length === 0) player.isAlive = false;
    const isOver = checkWinCondition();
    if (!isOver) {
        if (gameState.pendingDiscard.resumeAction) gameState.pendingAction = gameState.pendingDiscard.resumeAction;
        else passerAuProchainJoueur();
    }
    gameState.pendingDiscard = null;
    emitSecureStateToAll();
  });

  socket.on('exchange_cards', (kept, returned) => {
    const player = gameState.players.find(p => p.id === socket.id);
    player.cards = kept;
    
    broadcastReveal(player.name, { fr: "A défaussé au fond du paquet :", en: "Discarded to the deck:" }, returned);

    gameState.deck.push(...returned);
    for (let i = gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
    }
    gameState.pendingExchange = null;
    passerAuProchainJoueur();
    emitSecureStateToAll();
  });

  socket.on('police_decision', (decision) => {
    const target = gameState.players.find(p => p.id === gameState.pendingPoliceDecision.targetId);
    if (decision === 'change') {
        const oldCard = target.cards.splice(gameState.pendingPoliceDecision.cardIndex, 1)[0];
        broadcastReveal(target.name, { fr: "A été forcé de jeter :", en: "Was forced to drop:" }, [oldCard]);
        gameState.deck.push(oldCard);
        for (let i = gameState.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
        }
        target.cards.push(gameState.deck.shift());
    }
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
server.listen(PORT, () => console.log(`Online on ${PORT}`));