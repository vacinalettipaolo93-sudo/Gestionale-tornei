import React, { useState, useMemo, useEffect } from 'react';
import { type Event, type Tournament, type Player } from '../types';

interface PlayoffBracketBuilderProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
    isOrganizer: boolean;
}

const PlayoffBracketBuilder: React.FC<PlayoffBracketBuilderProps> = ({
    event, tournament, setEvents, isOrganizer
}) => {
    // Ottieni il numero di qualificati dai settings, aggiornato live!
    const playoffPlayersCount = tournament.settings?.playoffPlayers || 16;

    // Calcola i giocatori con posizione e gruppo (puoi sostituire con la tua vera classifica)
    const allRankings: {
        playerId: string,
        rank: number,
        fromGroup: string,
        groupName: string
    }[] = useMemo(() => {
        let standingsArr: { playerId: string, rank: number, fromGroup: string, groupName: string }[] = [];
        tournament.groups.forEach(group => {
            group.playerIds.forEach((pid, idx) => {
                standingsArr.push({
                    playerId: pid,
                    rank: idx + 1,
                    fromGroup: group.id,
                    groupName: group.name
                });
            });
        });
        standingsArr.sort((a, b) => a.rank - b.rank); // Puoi usare la tua logica qui!
        return standingsArr.slice(0, playoffPlayersCount);
    }, [tournament, playoffPlayersCount]);

    // Calcola la bracketSize (prossima potenza di 2)
    const bracketSize = useMemo(() => {
        const numPlayers = allRankings.length;
        if (numPlayers < 2) return 0;
        return 2 ** Math.ceil(Math.log2(numPlayers));
    }, [allRankings]);

    const [firstRoundAssignments, setFirstRoundAssignments] = useState<(string | null)[]>([]);

    // Aggiorna la bracket quando cambiano numPlayers/impostazioni
    useEffect(() => {
        setFirstRoundAssignments(Array(bracketSize).fill(null));
    }, [bracketSize]);

    const getPlayer = (id: string | null): Player | null =>
        id ? event.players.find(p => p.id === id) ?? null : null;

    const handleAssignmentChange = (slotIndex: number, value: string) => {
        setFirstRoundAssignments(prev => {
            const newAssignments = [...prev];
            const existingIndex = newAssignments.findIndex(v => v === value);
            if (existingIndex !== -1 && value !== 'BYE') {
                newAssignments[existingIndex] = null;
            }
            newAssignments[slotIndex] = value === '' ? null : value;
            return newAssignments;
        });
    };

    // Funzione per generare il tabellone (qui solo esempio, integralo con la tua logica firestore)
    const handleGenerateBracket = () => {
        // Qui salvi il tabellone su Firestore, aggiorni Tournament.playoffs, ecc.
        console.log("Genera playoff bracket", firstRoundAssignments);
        alert("Tabellone playoff generato! Collega qui la tua logica di salvataggio.");
    };

    const unassignedPlayers = allRankings.filter(q => !firstRoundAssignments.includes(q.playerId));
    const numByesAvailable = bracketSize - allRankings.length;
    const byesAssigned = firstRoundAssignments.filter(a => a === 'BYE').length;

    // Slot per assegnazione manuale
    const AssignmentSlot = ({ slotIndex }: { slotIndex: number }) => {
        const currentValue = firstRoundAssignments[slotIndex];
        const currentPlayer = getPlayer(currentValue);
        return (
            <select
                value={currentValue ?? ''}
                onChange={e => handleAssignmentChange(slotIndex, e.target.value)}
                className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
            >
                <option value="">-- Seleziona --</option>
                {currentValue && currentValue !== 'BYE' &&
                    <option value={currentValue}>{currentPlayer?.name}</option>
                }
                {unassignedPlayers
                    .slice()
                    .sort((a, b) => {
                        const playerA = getPlayer(a.playerId);
                        const playerB = getPlayer(b.playerId);
                        return (playerA?.name || '').localeCompare(playerB?.name || '');
                    })
                    .map(q => (
                        <option key={q.playerId} value={q.playerId}>{getPlayer(q.playerId)?.name}</option>
                    ))}
                {(byesAssigned < numByesAvailable || currentValue === 'BYE') &&
                    <option value="BYE">-- BYE --</option>
                }
            </select>
        );
    };

    return (
        <div className="bg-secondary p-6 rounded-xl shadow-lg max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonna tabellone */}
            <div className="lg:col-span-2">
                <h3 className="text-xl font-bold mb-2 text-accent">Costruttore Tabellone Playoff</h3>
                <p className="text-text-secondary mb-6">Assegna manualmente i giocatori qualificati agli slot del primo turno.</p>
                <div className="space-y-4">
                    {bracketSize > 0 ? Array.from({ length: bracketSize / 2 }).map((_, index) => (
                        <div key={index} className="bg-primary/50 p-4 rounded-lg flex items-center gap-4">
                            <span className="font-bold text-text-secondary">M{index+1}</span>
                            <div className="flex-1"><AssignmentSlot slotIndex={index * 2} /></div>
                            <span className="text-tertiary">vs</span>
                            <div className="flex-1"><AssignmentSlot slotIndex={index * 2 + 1} /></div>
                        </div>
                    )) : <p className="text-text-secondary">Nessun giocatore qualificato per il tabellone playoff.</p>}
                </div>
                <div className="mt-8">
                    <button
                        onClick={handleGenerateBracket}
                        disabled={firstRoundAssignments.some(a => a === null) || allRankings.length < 2}
                        className="w-full bg-highlight hover:bg-highlight/90 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        Genera Tabellone
                    </button>
                </div>
            </div>
            {/* Colonna riepilogo */}
            <div className="sticky top-4">
                <h4 className="font-semibold text-xl mb-4 text-accent">Riepilogo</h4>
                <div className="bg-primary/50 p-4 rounded-lg mb-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold">{allRankings.length}</div>
                            <div className="text-sm text-text-secondary">Qualificati</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{bracketSize}</div>
                            <div className="text-sm text-text-secondary">Posti</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{numByesAvailable}</div>
                            <div className="text-sm text-text-secondary">Bye</div>
                        </div>
                    </div>
                </div>
                <h4 className="font-semibold text-lg mb-3">Giocatori da Assegnare</h4>
                <div className="space-y-2">
                    {unassignedPlayers.length > 0 ? unassignedPlayers
                        .slice()
                        .sort((a, b) => {
                            const playerA = getPlayer(a.playerId);
                            const playerB = getPlayer(b.playerId);
                            return (playerA?.name || '').localeCompare(playerB?.name || '');
                        })
                        .map(q => {
                            const player = getPlayer(q.playerId);
                            return (
                                <div key={q.playerId} className="bg-tertiary/50 p-2 rounded-lg flex items-center gap-3">
                                    {player?.avatar && (
                                        <img src={player.avatar} alt={player.name} className="w-8 h-8 rounded-full" />
                                    )}
                                    <div>
                                        <div className="font-semibold text-sm">{player?.name}</div>
                                        <div className="text-xs text-text-secondary">{q.rank}° class. {q.groupName}</div>
                                    </div>
                                </div>
                            );
                        })
                        : <p className="text-text-secondary text-sm italic">Tutti i giocatori sono stati assegnati.</p>
                    }
                </div>
            </div>
        </div>
    );
};

export default PlayoffBracketBuilder;
