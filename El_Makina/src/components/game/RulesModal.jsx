import React from 'react';

const RulesModal = ({ onClose }) => {
  return (
    <div className="discard-overlay !z-[100] p-4 flex justify-center items-center">
      <div className="bg-gray-950 border-2 border-yellow-600/50 p-6 md:p-8 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-[0_0_80px_rgba(202,138,4,0.2)] text-left relative">
        
        {/* BOUTON FERMER */}
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-500 hover:text-white bg-gray-800 hover:bg-red-600 rounded-full w-10 h-10 flex items-center justify-center font-black text-xl transition-all"
        >
            ✕
        </button>

        <h2 className="text-3xl md:text-5xl font-black text-yellow-500 mb-6 tracking-widest uppercase text-center border-b border-gray-800 pb-6">
            Dossier Secret (Règles)
        </h2>

        <div className="space-y-8 text-gray-300">
            {/* LE BUT */}
            <section>
                <h3 className="text-2xl font-bold text-white mb-3 uppercase tracking-wider text-red-500">☠️ But du jeu</h3>
                <p className="text-sm md:text-base leading-relaxed bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                    Tu commences avec 2 pièces et 2 cartes (vies). Le but est d'éliminer tous les autres joueurs. 
                    Si tu perds tes 2 cartes, tu es éliminé. <strong className="text-yellow-400">Tu peux mentir sur les cartes que tu possèdes</strong>. 
                    Mais si quelqu'un te dit "Tchalenji" et que tu mens, tu perds une carte ! Si tu disais la vérité, c'est l'autre qui perd une carte.
                </p>
            </section>

            {/* ACTIONS DE BASE */}
            <section>
                <h3 className="text-2xl font-bold text-white mb-3 uppercase tracking-wider text-blue-400">💰 Actions Publiques (Pas de mensonge)</h3>
                <ul className="space-y-3 bg-gray-900/50 p-4 rounded-xl border border-gray-800 text-sm md:text-base">
                    <li><strong className="text-white">شهريّة (+1) :</strong> Prends 1 pièce de la banque. Personne ne peut bloquer.</li>
                    <li><strong className="text-white">إعانة (+2) :</strong> Prends 2 pièces. <span className="text-amber-500 font-bold">Bloqué par le Percepteur.</span></li>
                    <li><strong className="text-white">إنقلاب (-7) :</strong> Paye 7 pièces pour forcer un joueur à perdre une carte. Incontrable. <span className="text-purple-400 font-bold">Seule la Rachwa (-9) de n'importe quel joueur peut l'annuler.</span></li>
                </ul>
            </section>

            {/* LES PERSONNAGES */}
            <section>
                <h3 className="text-2xl font-bold text-white mb-3 uppercase tracking-wider text-green-400">🃏 Les Personnages (Mentir autorisé)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-white mb-1">رجل أعمال (Homme d'Affaires)</h4>
                        <p className="text-sm">Action : Prend <strong className="text-yellow-500">+4 pièces</strong>.</p>
                        <p className="text-sm mt-1 text-amber-500 font-bold">Vulnérable à la Taxe du Percepteur (perd 1 pièce par percepteur).</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-slate-400 mb-1">سياسي (Politicien)</h4>
                        <p className="text-sm">Action : Pioche 2 cartes du deck, garde-en 2 parmi tes cartes totales, et remets le reste.</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-red-500 mb-1">إرهابي (Terroriste)</h4>
                        <p className="text-sm">Action : Paye <strong className="text-red-400">-3 pièces</strong> pour assassiner un joueur (lui faire perdre 1 carte).</p>
                        <p className="text-sm mt-1 text-green-500 font-bold">Bloqué par le Colonel.</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-gray-400 mb-1">سارق (Voleur)</h4>
                        <p className="text-sm">Action : Vole <strong className="text-yellow-500">2 pièces</strong> à un joueur.</p>
                        <p className="text-sm mt-1 text-cyan-500 font-bold">Bloqué par la Police ou un autre Voleur.</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-amber-600 mb-1">القباضة (Percepteur)</h4>
                        <p className="text-sm">Action : Impôt sur la fortune ! Prend 1 pièce à tous ceux qui ont 7 pièces ou plus.</p>
                        <p className="text-sm mt-1">Défense : Bloque l'إعانة (+2).</p>
                        <p className="text-sm mt-1">Spécial : Peut taxer l'Homme d'affaires en direct !</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-emerald-600 mb-1">كولونيل (Colonel)</h4>
                        <p className="text-sm">Action : Paye <strong className="text-red-400">-4 pièces</strong>. Devine la carte d'un joueur. Si tu as bon, il perd l'argent et la carte ! Si tu as faux, tu perds l'argent.</p>
                        <p className="text-sm mt-1">Défense : Bloque le Terroriste.</p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl md:col-span-2 hover:border-gray-600 transition-colors">
                        <h4 className="text-lg font-black text-cyan-600 mb-1">بوليس (Police)</h4>
                        <p className="text-sm">Action : Interrogatoire. Regarde la carte d'un joueur secrètement. Tu peux la lui laisser ou l'obliger à en piocher une autre.</p>
                        <p className="text-sm mt-1">Défense : Bloque le Voleur et les interrogatoires d'autres Policiers.</p>
                    </div>
                </div>
            </section>
        </div>
      </div>
    </div>
  );
};

export default RulesModal;