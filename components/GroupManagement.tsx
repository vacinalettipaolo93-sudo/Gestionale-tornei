import React, { useState } from 'react';
import { type Event, type Tournament, type Group, type Player, type Match } from '../types';
import { TrashIcon } from './Icons';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface GroupManagementProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}

const makeId = () => `${Date.now()}${Math.floor(Math.random() * 10000)}`;

const GroupManagement: React.FC<GroupManagementProps> = ({ event, tournament, setEvents }) => {
    const [assigningGroup, setAssigningGroup] = useState<Group | null>(null);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [playerToRemove, setPlayerToRemove] = useState<{player: Player, group: Group} | null>(null);

    // --- States per aggiungi/modifica/elimina gironi ---
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupSize, setNewGroupSize] = useState<number>(4);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [editGroupSize, setEditGroupSize] = useState<number>(0);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    // ASSEGNA GIOCATORI E AGGIORNA FIRESTORE
    const handleSaveAssignments = async () => {
        if (!assigningGroup) return;

        const updatedGroups = tournament.groups.map(g =>
            g.id === assigningGroup.id ? { ...g, playerIds: Array.from(selectedPlayers) } : g
        );

        setEvents(prevEvents => prevEvents.map(e => {
            if (e.id !== event.id) return e;
            return {
                ...e,
                tournaments: e.tournaments.map(t => {
                    if (t.id !== tournament.id) return t;
                    return {
                        ...t,
                        groups: updatedGroups
                    };
                })
            };
        }));

        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, groups: updatedGroups } : t
            )
        });

        setAssigningGroup(null);
    };

    // RIMUOVI GIOCATORE E AGGIORNA FIRESTORE
    const handleRemovePlayer = async () => {
        if(!playerToRemove) return;
        const { player, group } = playerToRemove;

        const updatedGroups = tournament.groups.map(g => {
            if (g.id !== group.id) return g;
            return {
                ...g,
                playerIds: g.playerIds.filter(id => id !== player.id),
                matches: g.matches.filter(m => m.player1Id !== player.id && m.player2Id !== player.id)
            }
        });

        setEvents(prevEvents => prevEvents.map(e => {
            if (e.id !== event.id) return e;
            return {
                ...e,
                tournaments: e.tournaments.map(t => {
                    if (t.id !== tournament.id) return t;
                    return {
                        ...t,
                        groups: updatedGroups
                    };
                })
            };
        }));

        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, groups: updatedGroups } : t
            )
        });

        setPlayerToRemove(null);
    }

    // GENERA PARTITE E AGGIORNA FIRESTORE
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

        const updatedGroups = tournament.groups.map(g =>
            g.id === group.id ? { ...g, matches: newMatches } : g
        );

        setEvents(prevEvents => prevEvents.map(e => {
            if (e.id !== event.id) return e;
            return {
                ...e,
                tournaments: e.tournaments.map(t => {
                    if (t.id !== tournament.id) return t;
                    return {
                        ...t,
                        groups: updatedGroups
                    };
                })
            };
        }));

        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, groups: updatedGroups } : t
            )
        });
    };

    // ---------- Nuove funzioni: Aggiungi / Modifica / Elimina Gironi ----------
    const openAddGroup = () => {
        setNewGroupName('');
        setNewGroupSize(4);
        setError(null);
        setIsAddOpen(true);
    };

    const handleAddGroup = async () => {
        setLoading(true);
        setError(null);
        try {
            const newGroup: Group = {
                id: makeId(),
                name: newGroupName || `Girone ${tournament.groups.length + 1}`,
                playerIds: [], // partiamo senza giocatori; l'assegnamento è gestito dall'apposita modale
                matches: []
            } as any;

            const updatedGroups = [...tournament.groups, newGroup];

            // Aggiorna stato locale
            setEvents(prevEvents => prevEvents.map(e => {
                if (e.id !== event.id) return e;
                return {
                    ...e,
                    tournaments: e.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
                };
            }));

            // Persisti su Firestore
            await updateDoc(doc(db, "events", event.id), {
                tournaments: event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
            });

            setIsAddOpen(false);
        } catch (err: any) {
            console.error('Errore aggiunta girone', err);
            setError(err?.message || 'Errore durante la creazione del girone');
        } finally {
            setLoading(false);
        }
    };

    const openEditGroup = (g: Group) => {
        setEditingGroup(g);
        setEditGroupName(g.name);
        setEditGroupSize(g.playerIds?.length ?? 0);
        setError(null);
        setIsEditOpen(true);
    };

    const handleSaveEditGroup = async () => {
        if (!editingGroup) return;
        setLoading(true);
        setError(null);
        try {
            // Ridimensionamento playerIds: se si riduce, rimuoviamo gli ID rimossi e le partite collegate
            const original = editingGroup;
            const targetSize = Math.max(0, Math.floor(editGroupSize));
            let newPlayerIds = original.playerIds ? original.playerIds.slice(0, targetSize) : [];

            // se aumentiamo la dimensione, non aggiungiamo placeholder: lasciamo gli slot vuoti (array più lungo non necessario)
            if (targetSize > (original.playerIds?.length ?? 0)) {
                // non aggiungiamo valori fittizi, l'assegnamento avverrà tramite "Assegna Giocatori"
                // manteniamo gli stessi playerIds (nessuna aggiunta)
                newPlayerIds = original.playerIds ?? [];
            }

            // Rimuove le match che coinvolgono player rimossi (se la size è diminuita)
            const removedPlayerIds = (original.playerIds ?? []).slice(targetSize);
            const newMatches = original.matches ? original.matches.filter(m =>
                !removedPlayerIds.includes(m.player1Id) && !removedPlayerIds.includes(m.player2Id)
            ) : [];

            const updatedGroup: Group = {
                ...original,
                name: editGroupName,
                playerIds: newPlayerIds,
                matches: newMatches
            } as any;

            const updatedGroups = tournament.groups.map(g => g.id === updatedGroup.id ? updatedGroup : g);

            // Aggiorna stato locale
            setEvents(prevEvents => prevEvents.map(e => {
                if (e.id !== event.id) return e;
                return {
                    ...e,
                    tournaments: e.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
                };
            }));

            // Persisti su Firestore
            await updateDoc(doc(db, "events", event.id), {
                tournaments: event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
            });

            setIsEditOpen(false);
            setEditingGroup(null);
        } catch (err: any) {
            console.error('Errore salvataggio modifica girone', err);
            setError(err?.message || 'Errore durante il salvataggio della modifica');
        } finally {
            setLoading(false);
        }
    };

    const openDeleteGroup = (g: Group) => {
        setGroupToDelete(g);
        setIsDeleteOpen(true);
        setError(null);
    };

    const handleDeleteGroup = async () => {
        if (!groupToDelete) return;
        setLoading(true);
        setError(null);
        try {
            const updatedGroups = tournament.groups.filter(g => g.id !== groupToDelete.id);

            // Aggiorna stato locale
            setEvents(prevEvents => prevEvents.map(e => {
                if (e.id !== event.id) return e;
                return {
                    ...e,
                    tournaments: e.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
                };
            }));

            // Persisti su Firestore
            await updateDoc(doc(db, "events", event.id), {
                tournaments: event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
            });

            setGroupToDelete(null);
            setIsDeleteOpen(false);
        } catch (err: any) {
            console.error('Errore eliminazione girone', err);
            setError(err?.message || 'Errore durante l\'eliminazione del girone');
        } finally {
            setLoading(false);
        }
    };

    const getPlayer = (id: string) => event.players.find(p => p.id === id);

    return (
        <div className="space-y-6">
            {/* Header amministrazione gironi */}
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-accent">Gestione Gironi</h3>
                <div className="flex gap-2">
                    <button onClick={openAddGroup} className="bg-accent hover:bg-accent/90 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                        + Aggiungi Girone
                    </button>
                </div>
            </div>

            {tournament.groups.map(group => (
                <div key={group.id} className="bg-secondary p-4 rounded-xl shadow-md">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                            <h4 className="text-lg font-bold text-accent">{group.name}</h4>
                            <span className="text-sm text-text-secondary">{group.playerIds.length} giocatori</span>
                        </div>
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

                            {/* Edit / Delete girone (admin) */}
                            <button
                                onClick={() => openEditGroup(group)}
                                className="bg-tertiary hover:bg-tertiary/90 text-text-primary py-2 px-3 rounded-lg text-sm transition-colors"
                            >
                                Modifica
                            </button>

                            <button
                                onClick={() => openDeleteGroup(group)}
                                className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Elimina
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
                                            <button onClick={() => setPlayerToRemove({player, group})} className="opacity-0 group-hover/player:opacity-100 text-text-secondary/50 hover:text-red-500 transition-opacity">
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

            {/* Modal: Assegna giocatori */}
            {assigningGroup && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-lg border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Assegna Giocatori a {assigningGroup.name}</h4>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                           {event.players
                             .filter(p=>p.status === 'confirmed')
                             .slice()
                             .sort((a, b) => a.name.localeCompare(b.name))
                             .map(player => (
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

            {/* Modal: Conferma rimozione giocatore */}
            {playerToRemove && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Conferma Rimozione</h4>
                        <p className="text-text-secondary">Sei sicuro di voler rimuovere {playerToRemove.player.name} dal girone {playerToRemove.group.name}? Tutte le sue partite verranno eliminate dal girone.</p>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => setPlayerToRemove(null)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Annulla</button>
                            <button onClick={handleRemovePlayer} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Rimuovi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Aggiungi girone */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-sm border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Nuovo Girone</h4>
                        <input
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            placeholder="Nome girone"
                            className="w-full mb-2 p-2 rounded bg-primary border"
                            autoFocus
                        />
                        <p className="text-sm text-text-secondary mb-4">Dopo la creazione potrai assegnare i giocatori con "Assegna Giocatori".</p>
                        {error && <div className="text-red-400 mb-2">{error}</div>}
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setIsAddOpen(false)} className="bg-tertiary px-4 py-2 rounded">Annulla</button>
                            <button onClick={handleAddGroup} disabled={loading} className="bg-highlight text-white px-4 py-2 rounded">{loading ? 'Creando...' : 'Crea Girone'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Modifica girone */}
            {isEditOpen && editingGroup && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-sm border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Modifica Girone</h4>
                        <input
                            value={editGroupName}
                            onChange={e => setEditGroupName(e.target.value)}
                            placeholder="Nome girone"
                            className="w-full mb-2 p-2 rounded bg-primary border"
                            autoFocus
                        />
                        <label className="text-sm text-text-secondary">Numero attuale di giocatori: {editingGroup.playerIds.length}</label>
                        <p className="text-sm text-text-secondary mb-4">Per modificare i giocatori usa "Assegna Giocatori". Ridurre il numero rimuoverà i giocatori oltre la dimensione scelta e le loro partite.</p>
                        <div className="flex justify-end gap-4">
                            <button onClick={() => { setIsEditOpen(false); setEditingGroup(null); }} className="bg-tertiary px-4 py-2 rounded">Annulla</button>
                            <button onClick={handleSaveEditGroup} disabled={loading} className="bg-highlight text-white px-4 py-2 rounded">{loading ? 'Salvando...' : 'Salva Modifica'}</button>
                        </div>
                        {error && <div className="text-red-400 mt-2">{error}</div>}
                    </div>
                </div>
            )}

            {/* Modal: Elimina girone */}
            {isDeleteOpen && groupToDelete && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Conferma Eliminazione Girone</h4>
                        <p className="text-text-secondary">Sei sicuro di voler eliminare il girone "{groupToDelete.name}"? Questa azione rimuoverà anche le partite associate.</p>
                        {error && <div className="text-red-400 mt-2">{error}</div>}
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => { setIsDeleteOpen(false); setGroupToDelete(null); }} className="bg-tertiary px-4 py-2 rounded">Annulla</button>
                            <button onClick={handleDeleteGroup} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">{loading ? 'Eliminando...' : 'Elimina Girone'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupManagement;
