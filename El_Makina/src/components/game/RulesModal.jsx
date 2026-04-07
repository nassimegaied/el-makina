import React from 'react';

const RulesModal = ({ lang, onClose }) => {
  const isFr = lang === 'fr';

  return (
    <div className="discard-overlay !z-[100] p-4 flex justify-center items-center">
      <div className="bg-gray-950 border-2 border-yellow-600/50 p-6 md:p-8 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-[0_0_80px_rgba(202,138,4,0.2)] text-left relative">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-gray-800 hover:bg-red-600 rounded-full w-10 h-10 flex items-center justify-center font-black text-xl transition-all">✕</button>

        <h2 className="text-3xl md:text-5xl font-black text-yellow-500 mb-6 tracking-widest uppercase text-center border-b border-gray-800 pb-6">
            {isFr ? "Dossier Secret (Règles)" : "Secret File (Rules)"}
        </h2>

        <div className="space-y-8 text-gray-300">
            <section>
                <h3 className="text-2xl font-bold text-white mb-3 uppercase tracking-wider text-red-500">☠️ {isFr ? "But du jeu" : "Objective"}</h3>
                <p className="text-sm md:text-base leading-relaxed bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                    {isFr ? "Tu commences avec 2 pièces et 2 cartes (vies). Le but est d'éliminer tous les autres joueurs. Si tu perds tes 2 cartes, tu es éliminé. " : "You start with 2 coins and 2 cards (lives). The goal is to eliminate all other players. If you lose your 2 cards, you are out. "}
                    <strong className="text-yellow-400">{isFr ? "Tu peux mentir sur tes cartes" : "You can lie about your cards"}</strong>. 
                    {isFr ? " Mais si on te dit 'Tchalenji' et que tu mens, tu perds une carte ! Si tu disais la vérité, c'est l'autre qui perd." : " But if someone says 'Challenge' and you lied, you lose a card! If you told the truth, the challenger loses a card."}
                </p>
            </section>

            <section>
                <h3 className="text-2xl font-bold text-white mb-3 uppercase tracking-wider text-blue-400">💰 {isFr ? "Actions Publiques (Pas de mensonge)" : "Public Actions (No lying)"}</h3>
                <ul className="space-y-3 bg-gray-900/50 p-4 rounded-xl border border-gray-800 text-sm md:text-base">
                    <li><strong className="text-white">{isFr ? "شهريّة (+1) :" : "Income (+1) :"}</strong> {isFr ? "Prends 1 pièce de la banque. Personne ne peut bloquer." : "Take 1 coin from the bank. Cannot be blocked."}</li>
                    <li><strong className="text-white">{isFr ? "إعانة (+2) :" : "Foreign Aid (+2) :"}</strong> {isFr ? "Prends 2 pièces." : "Take 2 coins."} <span className="text-amber-500 font-bold">{isFr ? "Bloqué par le Percepteur." : "Blocked by Tax Collector."}</span></li>
                    <li><strong className="text-white">{isFr ? "إنقلاب (-7) :" : "Coup d'État (-7) :"}</strong> {isFr ? "Paye 7 pièces pour forcer un joueur à perdre une carte. Incontrable." : "Pay 7 coins to force a player to lose a card. Unblockable."} <span className="text-purple-400 font-bold">{isFr ? "Seule la Rachwa (-9) d'un joueur peut l'annuler." : "Only a Bribe (-9) can cancel it."}</span></li>
                </ul>
            </section>

            <section>
                <h3 className="text-2xl font-bold text-white mb-3 uppercase tracking-wider text-green-400">🃏 {isFr ? "Les Personnages (Mentir autorisé)" : "Characters (Lying allowed)"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-white mb-1">{isFr ? "رجل أعمال (Homme d'Affaires)" : "رجل أعمال (Businessman)"}</h4>
                        <p className="text-sm">{isFr ? "Action : Prend +4 pièces." : "Action: Takes +4 coins."}</p>
                        <p className="text-sm mt-1 text-amber-500 font-bold">{isFr ? "Vulnérable à la Taxe du Percepteur." : "Vulnerable to Tax Collector's tax."}</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-slate-400 mb-1">{isFr ? "سياسي (Politicien)" : "سياسي (Politician)"}</h4>
                        <p className="text-sm">{isFr ? "Action : Pioche 2 cartes du deck, garde-en 2 parmi tes cartes totales, et remets le reste." : "Action: Draw 2 cards, keep 2 of your total cards, discard the rest."}</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-red-500 mb-1">{isFr ? "إرهابي (Terroriste)" : "إرهابي (Terrorist)"}</h4>
                        <p className="text-sm">{isFr ? "Action : Paye -3 pièces pour assassiner un joueur." : "Action: Pay -3 coins to assassinate a player."}</p>
                        <p className="text-sm mt-1 text-green-500 font-bold">{isFr ? "Bloqué par le Colonel." : "Blocked by the Colonel."}</p>
                        <p className="text-xs mt-2 text-red-400 font-bold bg-red-950/30 p-2 rounded">
                            {isFr 
                            ? "⚠️ Règle Fatale : Si tu lances un assassinat, qu'on te dit 'Tchalenji' et que TU AS la carte, le contestataire perd 1 carte (erreur) ET l'assassinat a quand même lieu (Double Peine) !"
                            : "⚠️ Fatal Rule: If you assassinate, get challenged, and you HAVE the card, the challenger loses 1 card (wrong guess) AND the assassination still happens (Double Penalty)!"}
                        </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-gray-400 mb-1">{isFr ? "سارق (Voleur)" : "سارق (Thief)"}</h4>
                        <p className="text-sm">{isFr ? "Action : Vole 2 pièces à un joueur." : "Action: Steal 2 coins from a player."}</p>
                        <p className="text-sm mt-1 text-cyan-500 font-bold">{isFr ? "Bloqué par la Police ou un autre Voleur." : "Blocked by Police or another Thief."}</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-amber-600 mb-1">{isFr ? "القباضة (Percepteur)" : "القباضة (Tax Collector)"}</h4>
                        <p className="text-sm">{isFr ? "Action : Impôt ! Prend 1 pièce à tous ceux qui ont 7 pièces ou plus." : "Action: Tax! Takes 1 coin from anyone with 7+ coins."}</p>
                        <p className="text-sm mt-1">{isFr ? "Défense : Bloque l'إعانة (+2)." : "Defense: Blocks Foreign Aid (+2)."}</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-emerald-600 mb-1">{isFr ? "كولونيل (Colonel)" : "كولونيل (Colonel)"}</h4>
                        <p className="text-sm">{isFr ? "Action : Paye -4 pièces pour deviner la carte d'un joueur." : "Action: Pay -4 coins to guess a player's hidden card."}</p>
                        <p className="text-sm mt-1">{isFr ? "Défense : Bloque le Terroriste." : "Defense: Blocks the Terrorist."}</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl md:col-span-2 hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-cyan-600 mb-1">{isFr ? "بوليس (Police)" : "بوليس (Police)"}</h4>
                        <p className="text-sm">{isFr ? "Action : Regarde la carte d'un joueur secrètement. Laisse-la ou force le joueur à piocher." : "Action: Secretly inspect a player's card. Keep it or force them to change it."}</p>
                        <p className="text-sm mt-1">{isFr ? "Défense : Bloque le Voleur et les interrogatoires d'autres Policiers." : "Defense: Blocks the Thief and other Police inspections."}</p>
                    </div>
                </div>
            </section>
        </div>
      </div>
    </div>
  );
};

export default RulesModal;