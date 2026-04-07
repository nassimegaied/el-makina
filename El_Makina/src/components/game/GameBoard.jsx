import React, { useState, useEffect } from 'react';
import { socket } from '../../socket';
import Card from '../ui/Card';
import ActionModal from './ActionModal';
import RulesModal from './RulesModal';

const CHARACTERS = [ 'homme_daffaires', 'politicien', 'terroriste', 'voleur', 'colonel', 'percepteur', 'policier' ];

const GameBoard = () => {
  const [lang, setLang] = useState('fr'); // NOUVEAU: FR ou EN par défaut
  
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerName, setPlayerName] = useState('');
  
  const [isTargeting, setIsTargeting] = useState(false);
  const [roleToPlay, setRoleToPlay] = useState(null);
  const [exchangeSelection, setExchangeSelection] = useState([]);
  const [guessTarget, setGuessTarget] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [revealData, setRevealData] = useState(null);

  useEffect(() => {
    socket.connect();
    socket.on('connect', () => setIsConnected(true));
    socket.on('update_state', (newState) => {
        setGameState(newState);
        setIsTargeting(false); 
        if (!newState.pendingExchange) setExchangeSelection([]);
    });

    socket.on('public_reveal', (data) => {
        setRevealData(data);
        setTimeout(() => setRevealData(null), 4500); 
    });

    return () => {
      socket.off('connect');
      socket.off('update_state');
      socket.off('public_reveal');
      socket.disconnect();
    };
  }, []);

  const handleJoin = () => { if (playerName.trim()) socket.emit('join_table', playerName); };
  const handleStartGame = () => socket.emit('start_game');

  // Sélecteur de langue UI
  const UI = {
      bank: lang === 'fr' ? "BANQUE" : "BANK",
      myStash: lang === 'fr' ? "Ma Caisse" : "My Stash",
      coins: lang === 'fr' ? "Pièces" : "Coins",
      cards: lang === 'fr' ? "Cartes" : "Cards",
      eliminated: lang === 'fr' ? "Éliminé" : "Eliminated",
      spectator: lang === 'fr' ? "Spectateur" : "Spectator",
      salary: lang === 'fr' ? "Salaire (+1)" : "Income (+1)",
      aid: lang === 'fr' ? "Aide (+2)" : "Aid (+2)",
      tax: lang === 'fr' ? "Taxe" : "Tax",
      police: lang === 'fr' ? "Police" : "Police",
      colonel: lang === 'fr' ? "Colonel (-4)" : "Colonel (-4)",
      politician: lang === 'fr' ? "Politicien" : "Politician",
      business: lang === 'fr' ? "Business (+4)" : "Business (+4)",
      thief: lang === 'fr' ? "Voleur (+2)" : "Thief (+2)",
      terrorist: lang === 'fr' ? "Terroriste (-3)" : "Terrorist (-3)",
      coup: lang === 'fr' ? "Coup d'État (-7)" : "Coup (-7)",
      cancel: lang === 'fr' ? "Annuler" : "Cancel",
      yourTurn: lang === 'fr' ? "C'est ton tour" : "Your turn",
      chooseTarget: lang === 'fr' ? "Choisis ta cible !" : "Choose a target!"
  };

  const LangToggle = () => (
      <div className="absolute top-4 right-4 z-[65] flex gap-2 bg-gray-900/50 p-1 rounded-full backdrop-blur-md border border-gray-700">
          <button onClick={() => setLang('fr')} className={`px-3 py-1 rounded-full font-bold text-xs transition-all ${lang === 'fr' ? 'bg-yellow-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>FR</button>
          <button onClick={() => setLang('en')} className={`px-3 py-1 rounded-full font-bold text-xs transition-all ${lang === 'en' ? 'bg-yellow-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>EN</button>
      </div>
  );

  if (!gameState || gameState.status === 'waiting') {
    return (
      <div className="lobby-screen px-4 relative">
        <LangToggle />
        <h1 className="lobby-title text-4xl md:text-6xl">EL MAKINA</h1>
        <p className="lobby-subtitle text-sm md:text-xl">{lang === 'fr' ? "Le pouvoir s'achète" : "Power can be bought"}</p>
        {!gameState ? (
          <div className="flex flex-col items-center w-full mt-8">
            <input type="text" placeholder={lang === 'fr' ? "Ton Prénom" : "Your Name"} className="lobby-input w-full max-w-sm" value={playerName} onChange={(e) => setPlayerName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJoin()}/>
            <button onClick={handleJoin} className="btn-join w-full max-w-sm mt-4">{lang === 'fr' ? "Rejoindre la table" : "Join Table"}</button>
          </div>
        ) : (
          <div className="text-center mt-8 bg-gray-900/80 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-2xl w-full max-w-md">
            <h2 className="text-lg md:text-xl mb-6 font-bold text-gray-400 uppercase tracking-widest">{lang === 'fr' ? "Joueurs à table" : "Players at table"}</h2>
            <ul className="mb-8 space-y-3">
                {gameState.players.map(p => (
                    <li key={p.id} className="text-xl md:text-2xl font-black text-white bg-gray-800 py-2 rounded-lg border border-gray-700">{p.name}</li>
                ))}
            </ul>
            {gameState.players.length >= 3 ? (
               <button onClick={handleStartGame} className="btn-start w-full">{lang === 'fr' ? "Lancer la partie" : "Start Game"}</button>
            ) : (
               <p className="text-red-500 font-bold animate-pulse text-sm md:text-base">{lang === 'fr' ? `En attente de ${3 - gameState.players.length} joueur(s)...` : `Waiting for ${3 - gameState.players.length} player(s)...`}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (gameState.status === 'game_over') {
    const winner = gameState.winner;
    const amIWinner = winner?.id === socket.id;
    return (
      <div className="lobby-screen flex flex-col items-center justify-center min-h-screen text-center p-4 relative">
        <LangToggle />
        <div className="bg-gray-900/90 p-8 md:p-12 rounded-3xl border-4 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.5)] max-w-3xl w-full">
            <div className="text-5xl md:text-7xl mb-6 animate-bounce">👑</div>
            <h1 className="text-4xl md:text-8xl font-black text-yellow-500 drop-shadow-[0_0_30px_rgba(234,179,8,0.8)] mb-4 md:mb-6 leading-tight">
                {amIWinner ? (lang === 'fr' ? "VICTOIRE !" : "VICTORY!") : (lang === 'fr' ? "FIN DE PARTIE" : "GAME OVER")}
            </h1>
            <p className="text-xl md:text-3xl text-gray-300 font-bold tracking-widest mb-8 md:mb-12 uppercase">
                {amIWinner ? (lang === 'fr' ? "Tu es le nouveau Parrain" : "You are the new Godfather") : `${winner?.name} ${lang === 'fr' ? 'a pris le pouvoir' : 'took the power'}`}
            </p>
            <button onClick={() => socket.emit('return_to_lobby')} className="btn-victory w-full md:w-auto text-lg md:text-2xl">
                {lang === 'fr' ? "Retour au Lobby" : "Back to Lobby"}
            </button>
        </div>
      </div>
    );
  }

  const me = gameState.players.find(p => p.id === socket.id);
  const opponents = gameState.players.filter(p => p.id !== socket.id);
  const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === socket.id;
  
  const pendingDiscard = gameState.pendingDiscard;
  const isPendingDiscard = !!pendingDiscard;
  const iAmLoser = isPendingDiscard && pendingDiscard?.playerId === socket.id;
  const pendingExchange = gameState.pendingExchange;
  const isPendingExchange = !!pendingExchange;
  const iAmExchanger = isPendingExchange && pendingExchange?.playerId === socket.id;
  const pendingPoliceDecision = gameState.pendingPoliceDecision;
  const isPendingPoliceDecision = !!pendingPoliceDecision;
  const iAmPolice = isPendingPoliceDecision && pendingPoliceDecision?.policeId === socket.id;
  const amIBeingInspected = isPendingPoliceDecision && pendingPoliceDecision?.targetId === socket.id;
  const pendingAction = gameState.pendingAction;
  const haveIPassed = pendingAction?.hasPassed?.includes(socket.id);
  const isPendingActionForMe = !!pendingAction && pendingAction?.playerClaiming?.id !== socket.id && !haveIPassed && me?.isAlive;
  const actionTargetName = pendingAction?.targetId ? gameState.players.find(p => p.id === pendingAction.targetId)?.name : null;

  const handleSalary = () => { if (isMyTurn) socket.emit('take_salary'); };
  const handleAid = () => { if (isMyTurn) socket.emit('foreign_aid'); };
  const handleChallenge = () => socket.emit('challenge_action');
  const handleChallengeTaxer = (taxerId) => socket.emit('challenge_taxer', taxerId);
  const handlePass = () => socket.emit('pass_action');
  const handleBlock = (role) => socket.emit('block_action', role);
  const handleRachwa = () => socket.emit('rachwa');
  const handleTax = () => socket.emit('tax_businessman');
  const handleDiscardCard = (index) => { if (iAmLoser) socket.emit('discard_card', index); };

  const handleInitiateRole = (role, requiresTarget) => {
      if (requiresTarget) { setIsTargeting(true); setRoleToPlay(role); } 
      else { socket.emit('claim_role', { role: role, targetId: null }); }
  };

  const handleOpponentClick = (oppId) => {
      if (isTargeting) {
          if (roleToPlay === 'coup_detat') socket.emit('coup_detat', oppId);
          else if (roleToPlay === 'colonel_guess') setGuessTarget(oppId);
          else if (roleToPlay === 'police_inspect') socket.emit('police_inspect', oppId);
          else socket.emit('claim_role', { role: roleToPlay, targetId: oppId });
          setIsTargeting(false); setRoleToPlay(null);
      }
  };

  const handleColonelSubmit = (guessedRole) => {
      socket.emit('colonel_guess', { targetId: guessTarget, guessedRole: guessedRole });
      setGuessTarget(null);
  };

  const exchangePool = iAmExchanger ? [...me.cards, ...pendingExchange.drawnCards] : [];
  const toggleExchangeCard = (index) => {
      setExchangeSelection(prev => {
          if (prev.includes(index)) return prev.filter(i => i !== index);
          if (prev.length < me.cards.length) return [...prev, index]; 
          return prev;
      });
  };

  const confirmExchange = () => {
      if (exchangeSelection.length !== me.cards.length) return;
      const keptCards = exchangeSelection.map(i => exchangePool[i]);
      const returnedCards = exchangePool.filter((_, i) => !exchangeSelection.includes(i));
      socket.emit('exchange_cards', keptCards, returnedCards);
      setExchangeSelection([]);
  };

  const isInterfaceBlocked = !!pendingAction || isPendingDiscard || isPendingExchange || isPendingPoliceDecision || guessTarget;
  
  return (
    <div className="game-container flex flex-col h-screen overflow-hidden relative">
      <LangToggle />
      <button onClick={() => setShowRules(true)} className="absolute top-4 left-4 z-[65] bg-gray-900/80 text-yellow-500 border border-yellow-600/50 rounded-full w-10 h-10 md:w-12 md:h-12 flex items-center justify-center font-black text-xl hover:bg-gray-800 hover:scale-110 transition-all shadow-[0_0_15px_rgba(202,138,4,0.3)] backdrop-blur-md">?</button>
      
      {/* TODO: Si tu le souhaites, tu peux aussi rendre ActionModal et RulesModal bilingues plus tard en leur passant la prop `lang={lang}` */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {revealData && (
          <div className="discard-overlay flex flex-col items-center !z-[100] p-4 pointer-events-none">
              <div className="bg-gray-900/95 border-2 border-yellow-500 p-8 md:p-10 rounded-3xl text-center shadow-[0_0_80px_rgba(234,179,8,0.5)] backdrop-blur-sm w-full max-w-xl animate-pulse">
                  <h2 className="text-3xl md:text-5xl font-black text-white mb-2 uppercase tracking-widest">{revealData.playerName}</h2>
                  {/* On lit le texte bilingue envoyé par le serveur */}
                  <p className="text-yellow-500 font-bold mb-8 text-xl md:text-2xl">{revealData.text[lang] || revealData.text.fr}</p>
                  <div className="flex justify-center gap-6">
                      {revealData.cards.map((c, i) => (
                          <div key={i} className="scale-110 md:scale-125 mx-2"><Card character={c} isFaceUp={true} /></div>
                      ))}
                  </div>
              </div>
          </div>
      )}
        
      {isPendingActionForMe && !isPendingDiscard && !isPendingExchange && !isPendingPoliceDecision && (
        <ActionModal me={me} pendingAction={pendingAction} targetName={actionTargetName} canRachwa={me?.coins >= 9} onChallenge={handleChallenge} onChallengeTaxer={handleChallengeTaxer} onPass={handlePass} onBlock={handleBlock} onRachwa={handleRachwa} onTax={handleTax}/>
      )}

      {isPendingPoliceDecision && (
          <div className="discard-overlay flex flex-col items-center !z-[80] p-4">
              <div className="bg-gray-900 border-l-4 border-r-4 border-cyan-500 p-6 md:p-8 rounded-xl text-center shadow-[0_0_80px_rgba(6,182,212,0.3)] max-w-lg w-full">
                  <h2 className="text-2xl md:text-3xl font-black text-cyan-400 mb-2 tracking-widest uppercase">{lang === 'fr' ? "Interrogatoire" : "Interrogation"}</h2>
                  {iAmPolice ? (
                      <>
                          <p className="text-sm md:text-base text-gray-300 mb-4 md:mb-6">{lang === 'fr' ? "Tu fouilles" : "You inspect"} <span className="font-bold text-white">{pendingPoliceDecision.targetName}</span>.</p>
                          <div className="flex justify-center gap-6 mb-6 md:mb-8 scale-90 md:scale-110">
                              <Card character={pendingPoliceDecision.cardValue} isFaceUp={true} />
                          </div>
                          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                              <button onClick={() => socket.emit('police_decision', 'keep')} className="w-full bg-cyan-700 text-white font-black py-3 md:py-4 rounded-xl shadow-[0_5px_0_rgb(22,78,99)] active:translate-y-[5px] active:shadow-none transition-all">{lang === 'fr' ? "GARDER" : "KEEP"}</button>
                              <button onClick={() => socket.emit('police_decision', 'change')} className="w-full bg-red-700 text-white font-black py-3 md:py-4 rounded-xl shadow-[0_5px_0_rgb(153,27,27)] active:translate-y-[5px] active:shadow-none transition-all">{lang === 'fr' ? "CHANGER" : "CHANGE"}</button>
                          </div>
                      </>
                  ) : (
                      <p className="text-base md:text-xl text-gray-300 animate-pulse mt-4">{amIBeingInspected ? (lang === 'fr' ? `Le policier examine ta carte en secret...` : `Police is checking your card...`) : (lang === 'fr' ? `${pendingPoliceDecision.policeName} examine secrètement une carte...` : `${pendingPoliceDecision.policeName} is secretly checking a card...`)}</p>
                  )}
              </div>
          </div>
      )}

      {guessTarget && (
          <div className="discard-overlay flex flex-col items-center !z-[80] p-4">
              <div className="bg-gray-900 border-l-4 border-r-4 border-emerald-500 p-6 md:p-8 rounded-xl text-center shadow-[0_0_80px_rgba(16,185,129,0.3)] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <h2 className="text-2xl md:text-3xl font-black text-emerald-400 mb-2 tracking-widest uppercase">{lang === 'fr' ? "Roulette Russe" : "Russian Roulette"}</h2>
                  <p className="text-sm md:text-base text-gray-300 mb-4 md:mb-6">{lang === 'fr' ? "Quelle carte penses-tu que la cible cache ?" : "Which card do you think the target has?"} <br/><span className="text-xs md:text-sm text-red-400 font-bold">{lang === 'fr' ? "(Erreur = Tu perds 4🪙)" : "(Wrong = Lose 4🪙)"}</span></p>
                  
                  <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-6 md:mb-8">
                      {CHARACTERS.map((char, index) => (
                          <div key={index} onClick={() => handleColonelSubmit(char)} className="cursor-pointer hover:scale-105 transition-transform scale-75 md:scale-100">
                              <Card character={char} isFaceUp={true} />
                          </div>
                      ))}
                  </div>
                  <button onClick={() => setGuessTarget(null)} className="text-gray-500 hover:text-white font-bold uppercase underline text-sm md:text-base">{UI.cancel}</button>
              </div>
          </div>
      )}

      {iAmLoser && (
        <div className="discard-overlay p-4">
            <div className="discard-box w-full max-w-md p-6 md:p-10">
                <h2 className="text-2xl md:text-3xl font-black text-red-500 mb-2 md:mb-4 tracking-widest uppercase">{pendingDiscard?.wasLying ? (lang === 'fr' ? "Coupable" : "Guilty") : (lang === 'fr' ? "Exécution" : "Execution")}</h2>
                <p className="text-base md:text-xl text-gray-300">{pendingDiscard?.wasLying ? (lang === 'fr' ? "Tu t'es fait attraper !" : "You got caught!") : (lang === 'fr' ? "Le meurtre est commandité !" : "The hit is ordered!")}</p>
                <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-gray-800">
                    <p className="text-lg md:text-2xl font-black text-white animate-pulse">{lang === 'fr' ? "Choisis une carte à sacrifier." : "Choose a card to sacrifice."}</p>
                </div>
            </div>
        </div>
      )}

      {iAmExchanger && (
          <div className="discard-overlay flex flex-col items-center !z-[70] p-4">
              <div className="bg-gray-900 border-l-4 border-r-4 border-blue-500 p-6 md:p-8 rounded-xl text-center shadow-[0_0_80px_rgba(59,130,246,0.3)] w-full max-w-3xl mb-4 md:mb-8 max-h-[90vh] overflow-y-auto">
                  <h2 className="text-2xl md:text-3xl font-black text-blue-400 mb-2 tracking-widest uppercase">{lang === 'fr' ? "Secret d'État" : "State Secret"}</h2>
                  <p className="text-sm md:text-base text-gray-300 mb-4 md:mb-6">{lang === 'fr' ? "Choisis" : "Choose"} <span className="font-bold text-white">{me.cards.length}</span> {lang === 'fr' ? "carte(s) à garder en main." : "card(s) to keep."}</p>
                  
                  <div className="flex justify-center gap-2 md:gap-6 mb-6 md:mb-8 flex-wrap">
                      {exchangePool.map((char, index) => {
                          const isSelected = exchangeSelection.includes(index);
                          return (
                              <div key={index} onClick={() => toggleExchangeCard(index)} className={`transition-all cursor-pointer scale-75 md:scale-100 ${isSelected ? 'ring-4 ring-blue-500 md:scale-110 shadow-[0_0_20px_rgba(59,130,246,0.8)] rounded-xl' : 'opacity-50 hover:opacity-100 md:hover:-translate-y-2'}`}>
                                  <Card character={char} isFaceUp={true} />
                              </div>
                          );
                      })}
                  </div>
                  <button onClick={confirmExchange} disabled={exchangeSelection.length !== me.cards.length} className={`w-full md:w-auto px-6 md:px-10 py-3 md:py-4 rounded-xl font-black uppercase text-sm md:text-xl transition-all ${exchangeSelection.length === me.cards.length ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_5px_0_rgb(30,58,138)] active:translate-y-[5px] active:shadow-none' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
                      {lang === 'fr' ? "Valider la fraude" : "Confirm Exchange"}
                  </button>
              </div>
          </div>
      )}

      <div className="top-ring flex overflow-x-auto snap-x px-4 py-6 gap-4 md:gap-12 md:justify-center w-full mt-8">
        {opponents.map(opp => {
          const isOpponentTurn = gameState.players[gameState.currentTurnIndex]?.id === opp.id;
          const isTargetable = isTargeting && opp.isAlive;
          return (
            <div key={opp.id} onClick={() => isTargetable && handleOpponentClick(opp.id)} className={`avatar-wrapper snap-center shrink-0 flex flex-col items-center ${!opp.isAlive ? 'opacity-30 grayscale' : ''} ${isTargetable ? 'cursor-pointer hover:-translate-y-2' : ''}`}>
              <div className={`w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center text-2xl md:text-4xl font-black text-white ${isOpponentTurn ? 'bg-gradient-to-tr from-green-600 to-green-400 shadow-[0_0_25px_rgba(34,197,94,0.6)]' : 'bg-gray-800 border-2 border-gray-600'} ${isTargetable ? 'ring-4 ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)] animate-pulse' : ''}`}>
                {opp.isAlive ? opp.name?.charAt(0).toUpperCase() : 'X'}
              </div>
              <p className={`font-black tracking-widest uppercase text-[10px] md:text-xs mt-2 md:mt-3 ${isOpponentTurn ? 'text-green-400' : 'text-gray-400'}`}>{opp.name}</p>
              {opp.isAlive ? (
                  <div className="flex flex-col items-center mt-1">
                      <div className="bg-gray-900/80 px-2 md:px-3 py-1 rounded-full border border-gray-700 text-[10px] md:text-xs whitespace-nowrap">
                        <span className="text-yellow-400 font-bold">{opp.coins} {UI.coins}</span> <span className="text-gray-600 mx-1">|</span> <span className="text-blue-300 font-bold">{opp.cards} {UI.cards}</span>
                      </div>
                      <span className="text-[9px] md:text-[10px] font-bold text-yellow-600/80 mt-1 max-w-[100px] md:max-w-[120px] text-center truncate italic">
                          {/* Le serveur envoie maintenant un objet avec .fr et .en */}
                          {opp.lastAction?.[lang] || opp.lastAction?.fr || opp.lastAction}
                      </span>
                  </div>
              ) : (<span className="text-red-600 font-black text-[9px] md:text-[10px] mt-1 uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded">{UI.eliminated}</span>)}
            </div>
          );
        })}
      </div>

      <div className="middle-table flex-grow flex items-center justify-center">
        <div className="bg-gray-900/60 p-4 md:p-8 rounded-full border border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center w-32 h-32 md:w-48 md:h-48">
          <p className="text-sm md:text-2xl font-bold text-gray-500 tracking-[0.2em] md:tracking-[0.3em] uppercase mb-0 md:mb-1">{UI.bank}</p>
          <p className="text-4xl md:text-6xl font-black text-yellow-500 drop-shadow-md">{gameState.bankCoins}</p>
        </div>
      </div>

      <div className="bottom-dashboard bg-gray-950/95 backdrop-blur-xl border-t-2 border-gray-800 w-full z-[60] shadow-[0_-15px_40px_rgba(0,0,0,0.8)] px-2 md:px-6 py-4 md:pb-8 flex flex-col h-auto min-h-[35%] justify-end">
        {me?.isAlive === false ? (
            <div className="flex-grow flex items-center justify-center">
                <div className="text-center bg-gray-900/80 border border-gray-800 p-6 md:p-8 rounded-3xl"><p className="text-red-600 font-black text-3xl md:text-5xl tracking-widest drop-shadow-lg mb-1 md:mb-2">{UI.eliminated}</p><p className="text-gray-500 font-bold tracking-[0.2em] md:tracking-[0.3em] uppercase text-xs md:text-base">{UI.spectator}</p></div>
            </div>
        ) : (
            <>
                <div className="flex flex-row justify-between items-end mb-4 md:mb-8">
                  <div className="flex flex-col items-start bg-gray-900/80 p-2 md:p-4 rounded-xl border border-gray-800 min-w-[70px] md:min-w-[100px]">
                    <p className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0 md:mb-1">{UI.myStash}</p>
                    <p className="text-2xl md:text-4xl font-black text-yellow-500 leading-none">{me?.coins}</p>
                    <p className="text-[8px] text-yellow-600/70 italic mt-1 max-w-[80px] truncate">{me?.lastAction?.[lang] || me?.lastAction?.fr || me?.lastAction}</p>
                  </div>
                  
                  {isPendingDiscard && !iAmLoser ? (
                      <div className="flex flex-col items-end gap-2 animate-pulse"><span className="text-red-500 font-black tracking-widest uppercase bg-red-950/30 px-2 md:px-4 py-1 md:py-2 rounded-lg border border-red-900/50 text-[10px] md:text-sm text-right">☠️ {lang === 'fr' ? `Exécution de ${pendingDiscard?.playerName}...` : `Executing ${pendingDiscard?.playerName}...`}</span></div>
                  ) : isPendingExchange && !iAmExchanger ? (
                      <div className="flex flex-col items-end gap-2 animate-pulse"><span className="text-blue-500 font-black tracking-widest uppercase bg-blue-950/30 px-2 md:px-4 py-1 md:py-2 rounded-lg border border-blue-900/50 text-[10px] md:text-sm text-right">🔄 {lang === 'fr' ? `${pendingExchange?.playerName} échange ses cartes...` : `${pendingExchange?.playerName} is swapping cards...`}</span></div>
                  ) : isTargeting ? (
                      <div className="flex flex-col items-end gap-2"><span className="text-red-500 font-black tracking-widest uppercase bg-red-950/50 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-red-900 animate-pulse text-xs md:text-sm">{UI.chooseTarget}</span><button onClick={() => setIsTargeting(false)} className="text-gray-400 hover:text-white uppercase font-bold text-[10px] md:text-xs">{UI.cancel}</button></div>
                  ) : (
                      <div className="flex flex-col items-end gap-2 w-full ml-2">
                        {isMyTurn && !isInterfaceBlocked && (
                            <span className="text-green-500 font-black tracking-widest uppercase bg-green-950/30 px-3 md:px-4 py-1 rounded-md border border-green-900/50 text-[10px] md:text-sm mb-1">{UI.yourTurn}</span>
                        )}
                        <div className="flex gap-1.5 md:gap-3 flex-wrap justify-end overflow-y-auto max-h-[120px] md:max-h-none pr-1">
                          <style>{`.act-btn { padding: 6px 10px; font-size: 10px; border-radius: 6px; } @media (min-width: 768px) { .act-btn { padding: 12px 20px; font-size: 14px; border-radius: 12px; } }`}</style>
                          
                          <button onClick={handleSalary} disabled={!isMyTurn || isInterfaceBlocked} className="action-btn-base btn-salary act-btn">{UI.salary}</button>
                          <button onClick={handleAid} disabled={!isMyTurn || isInterfaceBlocked} className="action-btn-base btn-aid act-btn">{UI.aid}</button>
                          <button onClick={() => handleInitiateRole('percepteur', false)} disabled={!isMyTurn || isInterfaceBlocked} className="action-btn-base btn-tax act-btn">{UI.tax}</button>
                          <button onClick={() => handleInitiateRole('police_inspect', true)} disabled={!isMyTurn || isInterfaceBlocked} className="action-btn-base btn-police act-btn">{UI.police}</button>
                          <button onClick={() => handleInitiateRole('colonel_guess', true)} disabled={!isMyTurn || isInterfaceBlocked || (me?.coins < 4)} className="action-btn-base btn-colonel act-btn">{UI.colonel}</button>
                          <button onClick={() => handleInitiateRole('politicien', false)} disabled={!isMyTurn || isInterfaceBlocked} className="action-btn-base btn-politicien act-btn">{UI.politician}</button>
                          <button onClick={() => handleInitiateRole('homme_daffaires', false)} disabled={!isMyTurn || isInterfaceBlocked} className="action-btn-base btn-role act-btn">{UI.business}</button>
                          <button onClick={() => handleInitiateRole('voleur', true)} disabled={!isMyTurn || isInterfaceBlocked} className="action-btn-base btn-steal act-btn">{UI.thief}</button>
                          <button onClick={() => handleInitiateRole('terroriste', true)} disabled={!isMyTurn || isInterfaceBlocked || (me?.coins < 3)} className="action-btn-base btn-kill act-btn">{UI.terrorist}</button>
                          <button onClick={() => handleInitiateRole('coup_detat', true)} disabled={!isMyTurn || isInterfaceBlocked || (me?.coins < 7)} className={`action-btn-base act-btn border border-transparent ${me?.coins >= 7 ? 'bg-red-800 text-white shadow-lg' : 'bg-gray-800 text-gray-500 opacity-50'}`}>{UI.coup}</button>
                        </div>
                      </div>
                  )}
                </div>
                
                <div className="flex justify-center gap-2 md:gap-6 mt-auto">
                  {me?.cards?.map((character, index) => (
                    <div key={index} onClick={() => handleDiscardCard(index)} className={`transition-transform scale-90 md:scale-100 origin-bottom ${iAmLoser ? 'cursor-pointer hover:-translate-y-4 md:hover:-translate-y-6 ring-4 ring-red-500 animate-pulse rounded-xl relative z-[60]' : ''}`}>
                      <Card character={character} isFaceUp={true} />
                    </div>
                  ))}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default GameBoard;