import React from 'react';

const ActionModal = ({ me, pendingAction, targetName, canRachwa, onChallenge, onChallengeTaxer, onPass, onBlock, onRachwa, onTax }) => {
  if (!pendingAction) return null;

  const type = pendingAction.type;
  const claimerName = pendingAction.playerClaiming?.name;
  let title = "Alerte !";
  let message = "";
  
  if (type === 'foreign_aid') {
      title = "Demande de Fonds";
      message = `${claimerName} demande l'aide (+2 🪙).`;
  } else if (type === 'block') {
      title = "Objection !";
      const roleName = pendingAction.role.replace('_', ' ');
      message = `${claimerName} bloque avec ${roleName} !`;
  } else if (type === 'tax_businessman') {
      title = "Taxe !";
      const taxerNames = pendingAction.taxers.map(t => t.name).join(' et ');
      message = `${taxerNames} taxe(nt) l'homme d'affaires !`;
  } else if (type === 'coup_detat') {
      title = "Coup d'État !";
      message = `${claimerName} lance un Coup d'État sur ${targetName} ! Il a payé 7 🪙.`;
  } else if (type === 'role_claim') {
      title = "Alerte Tbl3it";
      const roleName = pendingAction.role.replace('_', ' ');
      message = targetName ? `${claimerName} joue ${roleName} sur ${targetName} !` : `${claimerName} joue ${roleName} !`;
  } else if (type === 'colonel_guess') {
      title = "Roulette du Colonel";
      const guessed = pendingAction.guessedRole.replace('_', ' ');
      message = `${claimerName} parie 4🪙 que ${targetName} cache la carte ${guessed} !`;
  } else if (type === 'police_inspect') {
      title = "Fouille de la Police";
      message = `${claimerName} veut inspecter les cartes de ${targetName} !`;
  }

  const btnStyle = "w-full text-white font-black text-xl py-4 rounded-2xl uppercase tracking-widest transition-all active:translate-y-[5px]";

  // CONDITIONS DE TAXE (Empêche l'auto-taxe)
  const isHommedAffaires = type === 'role_claim' && pendingAction.role === 'homme_daffaires';
  const isTaxingAction = type === 'tax_businessman';
  
  const amITheBusinessman = (isHommedAffaires && pendingAction.playerClaiming?.id === me?.id) || 
                            (isTaxingAction && pendingAction.originalAction?.playerClaiming?.id === me?.id);
                            
  const amIAlreadyTaxing = isTaxingAction && pendingAction.taxers?.some(t => t.id === me?.id);
  const canJoinTax = (isHommedAffaires || (isTaxingAction && pendingAction.taxers?.length < 3)) && !amIAlreadyTaxing && !amITheBusinessman;

  return (
    <div className="modal-overlay z-[70]">
      <div className="modal-container">
        <div className="modal-header">{title}</div>
        <div className="modal-body">
          <p className="modal-text">{message}</p>

          <div className="flex flex-col gap-4">
            
            {type === 'foreign_aid' && <button onClick={() => onBlock('percepteur')} className="btn-block">Contrer (Percepteur)</button>}

            {canJoinTax && (
                <button onClick={onTax} className={`${btnStyle} bg-gradient-to-b from-amber-600 to-amber-800 shadow-[0_5px_0_rgb(180,83,9)]`}>
                    Taxer (Percepteur)
                </button>
            )}
            
            {type === 'role_claim' && pendingAction.role === 'terroriste' && <button onClick={() => onBlock('colonel')} className={`${btnStyle} bg-gradient-to-b from-green-600 to-green-800 shadow-[0_5px_0_rgb(22,101,52)]`}>Contrer (Colonel)</button>}
            {type === 'role_claim' && pendingAction.role === 'voleur' && <button onClick={() => onBlock('voleur')} className={`${btnStyle} bg-gradient-to-b from-gray-500 to-gray-700 shadow-[0_5px_0_rgb(55,65,81)]`}>Contrer (Voleur)</button>}
            {type === 'police_inspect' && <button onClick={() => onBlock('policier')} className={`${btnStyle} bg-gradient-to-b from-blue-600 to-blue-800 shadow-[0_5px_0_rgb(30,58,138)]`}>Contrer (Police)</button>}
            {type === 'coup_detat' && <button onClick={onRachwa} disabled={!canRachwa} className="btn-rachwa">Rachwa (-9 🪙)</button>}
            
            {/* BOUTONS DE DÉFI SÉPARÉS POUR CHAQUE PERCEPTEUR ! */}
            {type === 'tax_businessman' && (
                <div className="flex flex-col gap-2 mb-2">
                    {pendingAction.taxers.map(taxer => (
                        taxer.id !== me?.id && (
                            <button key={taxer.id} onClick={() => onChallengeTaxer(taxer.id)} className="btn-tchalenji !py-3 !text-lg">
                                Tchalenji {taxer.name} !
                            </button>
                        )
                    ))}
                </div>
            )}

            {/* Bouton de défi classique (caché si c'est une taxe de groupe) */}
            {(type === 'role_claim' || type === 'block' || type === 'colonel_guess' || type === 'police_inspect') && (
                <button onClick={onChallenge} className="btn-tchalenji">Tchalenji !</button>
            )}
            
            <button onClick={onPass} className="btn-passer">Passer</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionModal;