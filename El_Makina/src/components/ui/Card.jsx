import React from 'react';


const Card = ({ character, isFaceUp = true }) => {
  // On garde juste les couleurs dynamiques ici
  const characterStyles = {
    'homme_daffaires': 'bg-gradient-to-br from-blue-100 to-blue-300 border-blue-600 text-blue-900',
    'politicien': 'bg-gradient-to-br from-purple-100 to-purple-300 border-purple-600 text-purple-900',
    'terroriste': 'bg-gradient-to-br from-red-100 to-red-300 border-red-700 text-red-900',
    'voleur': 'bg-gradient-to-br from-gray-200 to-gray-400 border-gray-800 text-gray-900',
    'colonel': 'bg-gradient-to-br from-green-100 to-green-300 border-green-700 text-green-900',
    'percepteur': 'bg-gradient-to-br from-yellow-100 to-yellow-300 border-yellow-600 text-yellow-900',
    'policier': 'bg-gradient-to-br from-cyan-100 to-blue-400 border-blue-800 text-blue-900',
  };

  const defaultStyle = 'bg-white border-gray-400 text-black';
  const cardColor = characterStyles[character] || defaultStyle;

  // Rendu du dos de la carte
  if (!isFaceUp) {
    return (
      <div className="elmakina-card-back">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:10px_10px]"></div>
        <div className="text-gray-300 font-black text-center -rotate-12 z-10">
          <span className="block text-xl tracking-[0.2em] drop-shadow-lg">EL</span>
          <span className="block text-xl tracking-[0.2em] drop-shadow-lg">MAKINA</span>
        </div>
      </div>
    );
  }

  // Rendu de la face de la carte (beaucoup plus propre à lire !)
  return (
    <div className={`elmakina-card ${cardColor}`}>
      <div className="elmakina-card-role-label">
        Rôle
      </div>

      <div className="elmakina-card-art">
         <span className="text-xs font-bold text-black/50 text-center leading-tight">Art</span>
      </div>
      
      <div className="elmakina-card-title">
        {character.replace('_', ' ')}
      </div>
    </div>
  );
};

export default Card;