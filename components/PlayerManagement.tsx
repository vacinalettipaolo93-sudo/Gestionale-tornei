import React, { useState } from 'react';
import { type Event, type Player } from '../types';

// FIREBASE IMPORTS
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

const createInitialsAvatar = (name: string): string => {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['#8b5cf6', '#22d3ee', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];
  const color = colors[initials.charCodeAt(0) % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="${color}"/><text x="50" y="50" font-family="Arial, sans-serif" font-size="50" fill="white" text-anchor="middle" dominant-baseline="central" dy=".1em">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

interface PlayerManagementProps {
  event: Event;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  onPlayerContact: (player: Player) => void;
}

const PlayerManagement: React.FC<PlayerManagementProps> = ({ event, setEvents, isOrganizer, onPlayerContact }) => {
    const [replacingPlayer, setReplacingPlayer] = useState<Player | null>(null);
    const [replacementTarget, setReplacementTarget] = useState<string>('');
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerPhone, setNewPlayerPhone] = useState('');
    
    const players = event.players;
    const confirmedPlayers = players.filter(p => p.status === 'confirmed');
    const pendingPlayers = players.filter(p => p.status === 'pending');

    // AGGIUNGI GIOCATORE IN FIRESTORE
    const handleAddPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newPlayerName.trim() || !newPlayerPhone.trim()) return;

        const newPlayer: Player = {
            id: `p${Date.now()}`,
            name: newPlayerName.trim(),
            phone: newPlayerPhone.trim(),
            avatar: createInitialsAvatar(newPlayerName.trim()),
            status: 'confirmed',
        };

        await updateDoc(doc(db, "events", event.id), {
            players: [...event.players, newPlayer]
        });

        setNewPlayerName('');
        setNewPlayerPhone('');
    };
    
    // CONFERMA GIOCATORE IN FIRESTORE
    const handleConfirmPlayer = async (playerId: string) => {
        const updatedPlayers = event.players.map(p => p.id === playerId ? {...p, status: 'confirmed'} : p);
        await updateDoc(doc(db, "events", event.id), {
            players: updatedPlayers
        });
    };
    
    // SOSTITUISCI GIOCATORE IN FIRESTORE
    const handleReplacePlayer = async () => {
        if (!replacingPlayer || !replacementTarget) return;

        // aggiorna in tutti i tornei e gruppi
        const newTournaments = event.tournaments.map(tourn => ({
            ...tourn,
            groups: tourn.groups.map(group => {
                if (!group.playerIds.includes(replacingPlayer.id)) return group;
                return {
                    ...group,
                    playerIds: group.playerIds.map(id => id === replacingPlayer.id ? replacementTarget : id),
                    matches: group.matches.map(match => {
                        if(match.player1Id === replacingPlayer.id) return {...match, player1Id: replacementTarget};
                        if(match.player2Id === replacingPlayer.id) return {...match, player2Id: replacementTarget};
                        return match;
                    })
                };
            })
        }));

        await updateDoc(doc(db, "events", event.id), {
            tournaments: newTournaments
        });

        setReplacingPlayer(null);
    };

    const potentialReplacements = confirmedPlayers.filter(p => p.id !== replacingPlayer?.id);

    return (
        <div className="bg-secondary p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold mb-6 text-accent">Partecipanti</h3>
            
             {isOrganizer && (
                <>
                <div className="mb-8 bg-primary/50 p-4 rounded-lg">
                    <h4 className="text-lg font-semibold mb-3">Aggiungi Nuovo Giocatore</h4>
                    <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-3">
                        <input 
                            type="text" 
                            placeholder="Nome Cognome" 
                            value={newPlayerName}
                            onChange={e => setNewPlayerName(e.target.value)}
                            className="flex-grow bg-secondary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
                            required
                        />
                        <input 
                            type="tel" 
                            placeholder="Numero di telefono" 
                            value={newPlayerPhone}
                            onChange={e => setNewPlayerPhone(e.target.value)}
                            className="flex-grow bg-secondary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
                            required
                        />
                        <button type="submit" className="bg-highlight hover:bg-highlight/90 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                            Aggiungi
                        </button>
                    </form>
                </div>

                <div className="mb-8">
                    <h4 className="text-lg font-semibold mb-3">Richieste di Iscrizione</h4>
                    {pendingPlayers.length > 0 ? (
                        <ul className="space-y-3">
                            {pendingPlayers.map(player => (
                                <li key={player.id} className="flex items-center justify-between bg-tertiary/50 p-3 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <img src={player.avatar} alt={player.name} className="w-10 h-10 rounded-full object-cover"/>
                                        <div>
                                            <div className="font-semibold">{player.name}</div>
                                            <div className="text-sm text-text-secondary">{player.phone}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleConfirmPlayer(player.id)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                                        Conferma
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-text-secondary italic">Nessuna richiesta di iscrizione in attesa.</p>}
                </div>
                </>
             )}

            <div>
                <h4 className="text-lg font-semibold mb-3">Partecipanti Confermati</h4>
                <ul className="space-y-3">
                    {confirmedPlayers.map(player => (
                        <li key={player.id} className="flex items-center justify-between bg-tertiary/50 p-3 rounded-lg">
                             <button onClick={() => onPlayerContact(player)} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
                                <img src={player.avatar} alt={player.name} className="w-10 h-10 rounded-full object-cover"/>
                                <div>
                                    <div className="font-semibold">{player.name}</div>
                                    <div className="text-sm text-text-secondary">{player.phone}</div>
                                </div>
                            </button>
                            {isOrganizer && (
                                <div className="flex gap-2">
                                    <button onClick={() => setReplacingPlayer(player)} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                                        Sostituisci
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            {isOrganizer && replacingPlayer && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Sostituisci {replacingPlayer.name}</h4>
                        <div className="space-y-4">
                            <p className="text-text-secondary">Seleziona un giocatore con cui sostituire {replacingPlayer.name}. I risultati precedenti verranno mantenuti.</p>
                            <select
                                value={replacementTarget}
                                onChange={(e) => setReplacementTarget(e.target.value)}
                                className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
                            >
                                <option value="">Seleziona un giocatore</option>
                                {potentialReplacements.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => setReplacingPlayer(null)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Annulla</button>
                            <button onClick={handleReplacePlayer} disabled={!replacementTarget} className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-tertiary disabled:cursor-not-allowed">Conferma Sostituzione</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerManagement;