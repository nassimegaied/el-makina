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
const rooms = {};

function initRoom(roomId) {
    return { roomId, status: "waiting", players: [], bankCoins: 0, deck: [], currentTurnIndex: 0, pendingAction: null, pendingDiscard: null, pendingExchange: null, pendingPoliceDecision: null, winner: null };
}

function createDeck() {
  let newDeck = [];
  CHARACTERS.forEach(c => newDeck.push(c, c, c));
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

function broadcastReveal(room, playerName, textObj, cards) {
    room.players.forEach(p => { io.to(p.id).emit('public_reveal', { playerName, text: textObj, cards }); });
}

function swapCard(room, player, oldCard) {
    const index = player.cards.indexOf(oldCard);
    if (index !== -1) {
        player.cards.splice(index, 1);
        broadcastReveal(room, player.name, { fr: "A prouvé son rôle et recycle son :", en: "Proved role and recycled:" }, [oldCard]);
        room.deck.push(oldCard);
        for (let i = room.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]];
        }
        player.cards.push(room.deck.shift());
    }
}

function emitSecureStateToAll(room) {
    room.players.forEach(player => {
        const stateForPlayer = { 
            ...room, 
            players: room.players.map(p => ({ ...p, cards: p.id === player.id ? p.cards : p.cards.length })),
            pendingExchange: room.pendingExchange ? { playerId: room.pendingExchange.playerId, playerName: room.pendingExchange.playerName, drawnCards: room.pendingExchange.playerId === player.id ? room.pendingExchange.drawnCards : [] } : null,
            pendingPoliceDecision: room.pendingPoliceDecision ? { policeId: room.pendingPoliceDecision.policeId, policeName: room.pendingPoliceDecision.policeName, targetId: room.pendingPoliceDecision.targetId, targetName: room.pendingPoliceDecision.targetName, cardValue: room.pendingPoliceDecision.policeId === player.id ? room.pendingPoliceDecision.cardValue : null } : null
        };
        io.to(player.id).emit('update_state', stateForPlayer);
    });
}

function checkWinCondition(room) {
    if (room.status !== 'playing') return false;
    const alivePlayers = room.players.filter(p => p.isAlive);
    if (alivePlayers.length === 1) { room.status = 'game_over'; room.winner = alivePlayers[0]; return true; }
    return false;
}

function passerAuProchainJoueur(room) {
    if (room.status !== 'playing') return;
    let loopCount = 0;
    do {
        room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
        loopCount++;
        if (loopCount > room.players.length) break; 
    } while (!room.players[room.currentTurnIndex].isAlive);
}

function setActionLog(room, playerId, textObj) {
    const p = room.players.find(x => x.id === playerId);
    if (p) p.lastAction = textObj;
}

function createPendingAction(room, type, claimer, opts = {}) {
    return { type, playerClaiming: claimer, hasPassed: [claimer.id], requiredPasses: room.players.filter(p => p.isAlive).length, ...opts };
}

function getRoleName(role, lang) {
    const map = { homme_daffaires: {fr:"Business", en:"Business"}, politicien: {fr:"Politicien", en:"Politician"}, terroriste: {fr:"Terroriste", en:"Terrorist"}, voleur: {fr:"Voleur", en:"Thief"}, colonel: {fr:"Colonel", en:"Colonel"}, percepteur: {fr:"Percepteur", en:"Tax Collector"}, policier: {fr:"Police", en:"Police"} };
    return map[role] ? map[role][lang] : role;
}

function executeAction(room, action) {
    if (!action) return false;
    const claimer = room.players.find(p => p.id === action.playerClaiming.id);
    
    if (action.type === 'foreign_aid') {
        const spaceLeft = 12 - claimer.coins; claimer.coins += Math.min(2, spaceLeft); room.bankCoins -= Math.min(2, spaceLeft);
        setActionLog(room, claimer.id, { fr: "A pris l'aide (+2)", en: "Took Foreign Aid (+2)" });
        return false;
    } else if (action.role === 'homme_daffaires') {
        const spaceLeft = 12 - claimer.coins; claimer.coins += Math.min(4, spaceLeft); room.bankCoins -= Math.min(4, spaceLeft);
        setActionLog(room, claimer.id, { fr: "A pris le business (+4)", en: "Took Business (+4)" });
        return false;
    } else if (action.role === 'voleur') {
        const targetPlayer = room.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive) {
            const stealAmount = Math.min(2, targetPlayer.coins); targetPlayer.coins -= stealAmount; claimer.coins = Math.min(12, claimer.coins + stealAmount);
            setActionLog(room, claimer.id, { fr: `A volé ${targetPlayer.name}`, en: `Stole from ${targetPlayer.name}` });
        }
        return false;
    } else if (action.role === 'terroriste') {
        claimer.coins -= 3; room.bankCoins += 3;
        const targetPlayer = room.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive) {
            setActionLog(room, claimer.id, { fr: `A frappé ${targetPlayer.name}`, en: `Targeted ${targetPlayer.name}` });
            room.pendingDiscard = { playerId: targetPlayer.id, playerName: targetPlayer.name, wasLying: false, resumeAction: null, resumeExecute: null };
            return true; 
        }
    } else if (action.role === 'politicien') {
        const drawn = room.deck.splice(0, 2);
        setActionLog(room, claimer.id, { fr: "Échange ses cartes", en: "Exchanging cards" });
        room.pendingExchange = { playerId: claimer.id, playerName: claimer.name, drawnCards: drawn };
        return true; 
    } else if (action.type === 'colonel_guess') {
        claimer.coins -= 4; room.bankCoins += 4;
        const targetPlayer = room.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive) {
            if (targetPlayer.cards.includes(action.guessedRole)) {
                const cardIndex = targetPlayer.cards.indexOf(action.guessedRole);
                const removedCard = targetPlayer.cards.splice(cardIndex, 1)[0];
                broadcastReveal(room, targetPlayer.name, { fr: "S'est fait exploser son :", en: "Got their card destroyed:" }, [removedCard]);
                room.deck.push(removedCard);
                for (let i = room.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]]; }
                setActionLog(room, claimer.id, { fr: `A eu raison sur ${targetPlayer.name} !`, en: `Guessed correctly on ${targetPlayer.name} !` });
                if (targetPlayer.cards.length === 0) { targetPlayer.isAlive = false; checkWinCondition(room); }
            } else { setActionLog(room, claimer.id, { fr: `S'est trompé sur ${targetPlayer.name}`, en: `Guessed wrong on ${targetPlayer.name}` }); }
        }
        return false;
    } else if (action.type === 'police_inspect') {
        const targetPlayer = room.players.find(p => p.id === action.targetId);
        if (targetPlayer && targetPlayer.isAlive && targetPlayer.cards.length > 0) {
            const cardIndex = Math.floor(Math.random() * targetPlayer.cards.length);
            room.pendingPoliceDecision = { policeId: claimer.id, policeName: claimer.name, targetId: targetPlayer.id, targetName: targetPlayer.name, cardIndex: cardIndex, cardValue: targetPlayer.cards[cardIndex] };
            setActionLog(room, claimer.id, { fr: `Fouille ${targetPlayer.name}`, en: `Inspecting ${targetPlayer.name}` });
            return true; 
        }
        return false;
    } else if (action.role === 'percepteur') {
        let totalTax = 0;
        room.players.forEach(p => { if (p.id !== claimer.id && p.isAlive && p.coins >= 7) { p.coins -= 1; totalTax += 1; } });
        claimer.coins = Math.min(12, claimer.coins + totalTax);
        setActionLog(room, claimer.id, { fr: "A prélevé la taxe", en: "Collected tax" });
        return false;
    }
    return false;
}

io.on('connection', (socket) => {
  socket.on('join_table', ({ playerName, roomId }) => {
    if (!rooms[roomId]) rooms[roomId] = initRoom(roomId);
    const room = rooms[roomId];
    
    // ANTI-CRASH & RECONNEXION: Cherche si ce nom existe déjà sur cette table
    const existingPlayer = room.players.find(p => p.name === playerName);
    
    if (existingPlayer) {
        // C'est un retour ! On met juste à jour son antenne réseau (socket.id)
        existingPlayer.id = socket.id;
    } else {
        // C'est un nouveau joueur
        if (room.status === 'playing' || room.status === 'game_over') return; // Trop tard pour les nouveaux
        room.players.push({ id: socket.id, name: playerName, coins: 2, cards: [], isAlive: true, lastAction: { fr: "A rejoint", en: "Joined" } });
    }

    socket.roomId = roomId; 
    socket.join(roomId);
    
    // Utiliser l'envoi sécurisé pour cacher les cartes !
    emitSecureStateToAll(room);
  });

  socket.on('return_to_lobby', () => {
    const room = rooms[socket.roomId]; if (!room || room.status !== 'game_over') return;
    room.status = 'waiting'; room.winner = null;
    room.players.forEach(p => { p.coins = 2; p.cards = []; p.isAlive = true; p.lastAction = { fr: "Prêt", en: "Ready" }; });
    emitSecureStateToAll(room);
  });

  socket.on('start_game', () => {
    const room = rooms[socket.roomId]; if (!room || room.players.length < 3) return;
    room.status = 'playing'; room.deck = createDeck(); room.bankCoins = 50;
    const cardsPerPlayer = (room.players.length <= 4) ? 3 : 2;
    room.players.forEach(p => { p.cards = room.deck.splice(0, cardsPerPlayer); p.lastAction = { fr: "La partie commence", en: "Game Started" }; });
    emitSecureStateToAll(room);
  });

  socket.on('take_salary', () => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (room.players[room.currentTurnIndex]?.id === socket.id && player.isAlive) {
        player.coins = Math.min(12, player.coins + 1); room.bankCoins -= 1;
        setActionLog(room, player.id, { fr: "A pris 1 Salaire", en: "Took 1 Income" });
        passerAuProchainJoueur(room); emitSecureStateToAll(room); 
    }
  });

  socket.on('foreign_aid', () => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (room.players[room.currentTurnIndex]?.id === socket.id && player.isAlive) {
        room.pendingAction = createPendingAction(room, 'foreign_aid', player);
        setActionLog(room, player.id, { fr: "Demande l'aide", en: "Asks for Aid" });
        emitSecureStateToAll(room);
    }
  });

  socket.on('claim_role', (data) => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (room.players[room.currentTurnIndex]?.id === socket.id && player.isAlive) {
        room.pendingAction = createPendingAction(room, 'role_claim', player, { role: data.role, targetId: data.targetId || null });
        setActionLog(room, player.id, { fr: `Joue ${getRoleName(data.role, 'fr')}`, en: `Plays ${getRoleName(data.role, 'en')}` });
        emitSecureStateToAll(room);
    }
  });

  socket.on('colonel_guess', (data) => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (room.players[room.currentTurnIndex]?.id === socket.id && player.isAlive && player.coins >= 4) {
        room.pendingAction = createPendingAction(room, 'colonel_guess', player, { targetId: data.targetId, guessedRole: data.guessedRole });
        setActionLog(room, player.id, { fr: "Pari du Colonel", en: "Colonel's Guess" });
        emitSecureStateToAll(room);
    }
  });

  socket.on('police_inspect', (targetId) => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (room.players[room.currentTurnIndex]?.id === socket.id && player.isAlive) {
        room.pendingAction = createPendingAction(room, 'police_inspect', player, { targetId });
        setActionLog(room, player.id, { fr: "Interrogatoire", en: "Interrogation" });
        emitSecureStateToAll(room);
    }
  });

  socket.on('block_action', (blockRole) => {
    const room = rooms[socket.roomId]; if (!room) return;
    const blocker = room.players.find(p => p.id === socket.id);
    if (blocker && blocker.isAlive && room.pendingAction) {
        setActionLog(room, blocker.id, { fr: `Bloque (${getRoleName(blockRole, 'fr')})`, en: `Blocks (${getRoleName(blockRole, 'en')})` });
        room.pendingAction = createPendingAction(room, 'block', blocker, { role: blockRole, originalAction: room.pendingAction });
        emitSecureStateToAll(room);
    }
  });

  socket.on('tax_businessman', () => {
    const room = rooms[socket.roomId]; if (!room) return;
    const taxer = room.players.find(p => p.id === socket.id);
    if (taxer && taxer.isAlive && room.pendingAction?.role === 'homme_daffaires') {
        if (room.pendingAction.type === 'role_claim') { room.pendingAction = createPendingAction(room, 'tax_businessman', taxer, { role: 'percepteur', taxers: [taxer], originalAction: room.pendingAction }); } 
        else if (room.pendingAction.type === 'tax_businessman' && room.pendingAction.taxers.length < 3) { room.pendingAction.taxers.push(taxer); }
        setActionLog(room, taxer.id, { fr: "Taxe !", en: "Taxes!" });
        emitSecureStateToAll(room);
    }
  });

  socket.on('coup_detat', (targetId) => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (room.players[room.currentTurnIndex]?.id === socket.id && player.isAlive && player.coins >= 7) {
        player.coins -= 7; room.bankCoins += 7;
        room.pendingAction = createPendingAction(room, 'coup_detat', player, { targetId });
        setActionLog(room, player.id, { fr: "Coup d'État !", en: "Coup d'État !" });
        emitSecureStateToAll(room);
    }
  });

  socket.on('rachwa', () => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player && player.isAlive && player.coins >= 9 && room.pendingAction?.type === 'coup_detat') {
        player.coins -= 9; room.bankCoins += 9; room.pendingAction = null;
        setActionLog(room, player.id, { fr: "Rachwa (Pot-de-vin) !", en: "Paid a bribe!" });
        passerAuProchainJoueur(room); emitSecureStateToAll(room);
    }
  });

  socket.on('pass_action', () => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive || !room.pendingAction || room.pendingAction.hasPassed.includes(socket.id)) return;
    room.pendingAction.hasPassed.push(socket.id);
    setActionLog(room, player.id, { fr: "Passe", en: "Passes" });

    if (room.pendingAction.hasPassed.length >= room.pendingAction.requiredPasses) {
        let needsPause = false;
        if (room.pendingAction.type === 'block') { needsPause = false; } 
        else if (room.pendingAction.type === 'coup_detat') {
            const target = room.players.find(p => p.id === room.pendingAction.targetId);
            room.pendingDiscard = { playerId: target.id, playerName: target.name, wasLying: false, resumeAction: null, resumeExecute: null };
            needsPause = true;
        } else if (room.pendingAction.type === 'tax_businessman') {
            const taxers = room.pendingAction.taxers; const businessman = room.players.find(p => p.id === room.pendingAction.originalAction.playerClaiming.id);
            businessman.coins = Math.min(12, businessman.coins + Math.max(0, 4 - taxers.length));
            taxers.forEach(t => { const p = room.players.find(x => x.id === t.id); p.coins = Math.min(12, p.coins + 1); });
            needsPause = false;
        } else { needsPause = executeAction(room, room.pendingAction); }
        room.pendingAction = null;
        if (!needsPause) passerAuProchainJoueur(room);
    }
    emitSecureStateToAll(room);
  });

  socket.on('challenge_taxer', (taxerId) => {
    const room = rooms[socket.roomId]; if (!room) return;
    const challenger = room.players.find(p => p.id === socket.id); const taxer = room.players.find(p => p.id === taxerId);
    if (!challenger || !taxer || !room.pendingAction) return;
    const hasCard = taxer.cards.includes('percepteur'); let loser;
    if (hasCard) { loser = challenger; swapCard(room, taxer, 'percepteur'); } 
    else { loser = taxer; room.pendingAction.taxers = room.pendingAction.taxers.filter(t => t.id !== taxerId); }
    room.pendingDiscard = { playerId: loser.id, playerName: loser.name, wasLying: !hasCard, resumeAction: room.pendingAction, resumeExecute: null };
    room.pendingAction = null; emitSecureStateToAll(room);
  });

  socket.on('challenge_action', () => {
    const room = rooms[socket.roomId]; if (!room) return;
    const challenger = room.players.find(p => p.id === socket.id);
    if (!challenger || !challenger.isAlive || !room.pendingAction) return;

    const action = room.pendingAction;
    const claimer = room.players.find(p => p.id === action.playerClaiming.id);
    let roleToCheck = action.role;
    if (action.type === 'colonel_guess') roleToCheck = 'colonel';
    if (action.type === 'police_inspect') roleToCheck = 'policier';

    const hasCard = claimer.cards.includes(roleToCheck);
    let loser;

    if (hasCard) {
        loser = challenger;
        swapCard(room, claimer, roleToCheck);
        room.pendingDiscard = { 
            playerId: loser.id, playerName: loser.name, wasLying: false, 
            resumeAction: null, 
            resumeExecute: ['role_claim', 'colonel_guess', 'police_inspect'].includes(action.type) ? action : null 
        };
    } else {
        loser = claimer;
        room.pendingDiscard = { 
            playerId: loser.id, playerName: loser.name, wasLying: true, 
            resumeAction: null, 
            resumeExecute: action.type === 'block' ? action.originalAction : null 
        };
    }

    room.pendingAction = null;
    emitSecureStateToAll(room);
  });

  socket.on('discard_card', (cardIndex) => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !room.pendingDiscard || room.pendingDiscard.playerId !== socket.id) return;
    
    const deadCard = player.cards.splice(cardIndex, 1)[0];
    broadcastReveal(room, player.name, { fr: "A perdu la carte :", en: "Lost the card:" }, [deadCard]);
    room.deck.push(deadCard);
    for (let i = room.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]]; }
    if (player.cards.length === 0) player.isAlive = false;
    
    const isOver = checkWinCondition(room);
    if (!isOver) {
        const resumeAct = room.pendingDiscard.resumeAction;
        const resumeExec = room.pendingDiscard.resumeExecute;
        room.pendingDiscard = null;

        if (resumeAct) {
            room.pendingAction = resumeAct;
        } else if (resumeExec) {
            const needsPause = executeAction(room, resumeExec);
            if (!needsPause) passerAuProchainJoueur(room);
        } else {
            passerAuProchainJoueur(room);
        }
    } else {
        room.pendingDiscard = null;
    }
    emitSecureStateToAll(room);
  });

  socket.on('exchange_cards', (kept, returned) => {
    const room = rooms[socket.roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    player.cards = kept;
    broadcastReveal(room, player.name, { fr: "A défaussé au fond du paquet :", en: "Discarded to the deck:" }, returned);
    room.deck.push(...returned);
    for (let i = room.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]]; }
    room.pendingExchange = null; passerAuProchainJoueur(room); emitSecureStateToAll(room);
  });

  socket.on('police_decision', (decision) => {
    const room = rooms[socket.roomId]; if (!room) return;
    const target = room.players.find(p => p.id === room.pendingPoliceDecision.targetId);
    if (decision === 'change') {
        const oldCard = target.cards.splice(room.pendingPoliceDecision.cardIndex, 1)[0];
        broadcastReveal(room, target.name, { fr: "A été forcé de jeter :", en: "Was forced to drop:" }, [oldCard]);
        room.deck.push(oldCard);
        for (let i = room.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]]; }
        target.cards.push(room.deck.shift());
    }
    room.pendingPoliceDecision = null; passerAuProchainJoueur(room); emitSecureStateToAll(room);
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.roomId];
    if (room) {
        // Ne le supprime complètement QUE s'il est encore dans la salle d'attente.
        // Si le jeu a commencé, on le garde en mémoire pour qu'il puisse se reconnecter !
        if (room.status === 'waiting') {
            room.players = room.players.filter(p => p.id !== socket.id);
        }
        
        checkWinCondition(room);
        emitSecureStateToAll(room);
        
        if (room.players.length === 0) delete rooms[socket.roomId];
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Online on ${PORT}`));