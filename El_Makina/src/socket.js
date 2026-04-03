import { io } from 'socket.io-client';

/**
 * Sur Internet (Vercel), l'URL sera injectée via VITE_SERVER_URL.
 * Sur ton PC en local, il utilisera 'http://localhost:3001'.
 */
const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(URL, {
  autoConnect: false,
  // Ajout de reconnexion automatique pour la stabilité en ligne
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});