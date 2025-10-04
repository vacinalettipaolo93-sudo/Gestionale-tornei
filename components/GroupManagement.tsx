import React, { useState } from 'react';
import { type Event, type Tournament, type Group, type Player, type Match } from '../types';
import { TrashIcon } from './Icons';

// FIREBASE IMPORTS
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

interface GroupManagementProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}

const GroupManagement: React.FC<GroupManagementProps> = ({ event, tournament, setEvents }) => {
    const [assigningGroup, setAssigningGroup] = useState<Group | null>(null);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [playerToRemove, setPlayerToRemove] = useState<{player: Player, group: Group} | null>(null);

    const openAssignModal = (group: Group) => {
        setAssigningGroup(group);
        setSelectedPlayers(new Set(group.playerIds));
    };

    const handlePlayerSelection = (playerId: string) => {
        setSelectedPlayers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerId)) {
                newSet.delete(playerId);
            } else {
                newSet.add(playerId);
            }
            return newSet;
        });
    };

    // AGGIORNA ASSEGNAZIONI GRUPPO SU FIRESTORE
    const handleSaveAssignments = async () => {
        if (!assigningGroup) return;

        const tournamentsUpdated = event.tournaments.map(t => {
            if (t.id !== tournament.id) return t;
            return {
                ...t,
                groups: t.groups.map(g => 
                    g.id === assigningGroup.id ? { ...g, playerIds: Array.from(selectedPlayers) } : g
                )
            };
        });

        await updateDoc(doc(db, "events", event.id), { tournaments: tournamentsUpdated });
        setAssigningGroup(null);
    };

    // RIMOZIONE GIOCATORE DA GRUPPO IN FIRESTORE
    const handleRemovePlayer = async () => {
        if(!playerToRemove) return;
        const { player, group } = playerToRemove;

        const tournamentsUpdated = event.tournaments.map(t => {
            if (t.id !== tournament.id) return t;
            return {
                ...t,
                groups: t.groups.map(g => {
                    if (g.id !== group.id) return g;
                    return {
                        ...g,
                        playerIds: g.playerIds.filter(id => id !== player.id),
                        matches: g.matches.filter(m => m.player1Id !== player.id && m.player2Id !== player.id)
                    }
                })
            };
        });

        await updateDoc(doc(db, "events", event.id), { tournaments: tournamentsUpdated });
        setPlayerToRemove(null);
    }

    // GENERA PARTITE PER IL GRUPPO IN FIRESTORE
    const handleGenerateMatches = async (group: Group) => {
        if (group.playerIds.length < 2) {
            alert("Sono necessari almeno 2 giocatori per generare le partite.");
            return;
        }

        const newMatches: Match[] = [];
        for (let i = 0; i < group.playerIds.length; i++) {
            for (let j = i + 1; j < group.playerIds.length; j++) {
                newMatches.push({
                    id: `m${Date.now()}${i}${j}`,
                    player1Id: group.playerIds[i],
                    player2Id: group.playerIds[j],
                    score1: null,
                    score2: null,
                    status: 'pending',
                });
            }
        }

        const tournamentsUpdated = event.tournaments.map(t => {
            if (t.id !== tournament.id) return t;
            return {
                ...t,
                groups: t.groups.map(g => 
                    g.id === group.id ? { ...g, matches: newMatches } : g
                )
            };
        });

        await updateDoc(doc(db, "events", event.id), { tournaments: tournamentsUpdated });
    };

    const getPlayer = (id: string) => event.players.find(p => p.id === id);

    return (
        <div className="space-y-6">
            {tournament.groups.map(group => (
                <div key={group.id} className="bg-secondary p-4 rounded-xl shadow-md">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <h4 className="text-lg font-bold text-accent">{group.name}</h4>
                        <div className="flex gap-2">
                             <button onClick={() => openAssignModal(group)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                                Assegna Giocatori
                            </button>
                            <button 
                                onClick={() => handleGenerateMatches(group)} 
                                disabled={group.playerIds.length < 2}
                                className="bg-highlight hover:bg-highlight/90 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors disabled:bg-tertiary disabled:cursor-not-allowed"
                            >
                                Genera Partite
                            </button>
                        </div>
                    </div>
                    <div>
                        <h5 className="text-sm font-semibold mb-2 text-text-secondary">Giocatori Assegnati ({group.playerIds.length})</h5>
                        {group.playerIds.length > 0 ? (
                            <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {group.playerIds.map(playerId => {
                                    const player = getPlayer(playerId);
                                    return player ? (
                                        <li key={playerId} className="bg-tertiary/50 p-2 rounded-lg flex items-center justify-between gap-2 group/player">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <img src={player.avatar} alt={player.name} className="w-8 h-8 rounded-full flex-shrink-0 object-cover" />
                                                <span className="text-sm font-medium truncate">{player.name}</span>
                                            </div>
                                            <button onClick={() => setPlayerToRemove({player, group})} className="opacity-0 group-hover/player:opacity-100 text-text-secondary/50 hover:text-red-500 transition-all">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ) : null;
                                })}
                            </ul>
                        ) : <p className="text-text-secondary/80 italic text-sm">Nessun giocatore assegnato a questo girone.</p>}
                    </div>
                </div>
            ))}
             {tournament.groups.length === 0 && (
                <p className="text-center text-text-secondary py-8">Crea un girone per iniziare la gestione.</p>
             )}

            {assigningGroup && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-lg border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Assegna Giocatori a {assigningGroup.name}</h4>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                           {event.players.filter(p=>p.status === 'confirmed').map(player => (
                                <label key={player.id} className="flex items-center gap-3 p-2 bg-tertiary/50 rounded-lg cursor-pointer hover:bg-tertiary">
                                    <input
                                        type="checkbox"
                                        checked={selectedPlayers.has(player.id)}
                                        onChange={() => handlePlayerSelection(player.id)}
                                        className="w-5 h-5 rounded bg-primary border-tertiary text-accent focus:ring-accent ring-offset-secondary"
                                    />
                                     <img src={player.avatar} alt={player.name} className="w-8 h-8 rounded-full object-cover" />
                                    <span>{player.name}</span>
                                </label>
                           ))}
                           {event.players.filter(p=>p.status === 'confirmed').length === 0 && <p className="text-text-secondary">Nessun giocatore confermato da assegnare. Aggiungi giocatori dalla scheda "Giocatori".</p>}
                        </div>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => setAssigningGroup(null)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Annulla</button>
                            <button onClick={handleSaveAssignments} className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-4 rounded-lg transition-colors">Salva Assegnazioni</button>
                        </div>
                    </div>
                </div>
            )}

            {playerToRemove && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Conferma Rimozione</h4>
                        <p className="text-text-secondary">Sei sicuro di voler rimuovere {playerToRemove.player.name} dal girone {playerToRemove.group.name}? Tutte le sue partite verranno eliminate.</p>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => setPlayerToRemove(null)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Annulla</button>
                            <button onClick={handleRemovePlayer} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Rimuovi</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupManagement;