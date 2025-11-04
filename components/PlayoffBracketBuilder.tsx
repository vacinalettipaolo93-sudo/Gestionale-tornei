import React, { useState, useMemo, useEffect } from 'react';
import { type Event, type Tournament, type Player } from '../types';
import { calculateStandings } from '../utils/standings';

interface PlayoffBracketBuilderProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
    isOrganizer: boolean;
}

const PlayoffBracketBuilder: React.FC<PlayoffBracketBuilderProps> = ({
    event, tournament, setEvents, isOrganizer
}) => {
    // ------------- LOGICA QUALIFICATI PLAYOFF come Consolation ma con playoffSettings! -------------
    const qualifiers = useMemo(() => {
        const allQualifiers: { playerId: string, rank: number, fromGroup: string, groupName: string }[] = [];
        (tournament.groups ?? []).forEach(group => {
            const setting = tournament.settings.playoffSettings?.find(s => s.groupId === group.id);
            const num = setting?.numQualifiers ?? 0;
            if (num > 0) {
                // Calcola la classifica reale del girone
                const standings = calculateStandings(group, event.players, tournament.settings);
                const groupQualifiers = standings.slice(0, num).map((entry, idx) => ({
                    playerId: entry.playerId,
                    rank: idx + 1,
                    fromGroup: group.id,
                    groupName: group.name
                }));
                allQualifiers.push(...groupQualifiers);
            }
        });
        return allQualifiers;
    }, [tournament.groups, event.players, tournament.settings]);

    // Bracket size: next power of 2
    const bracketSize = useMemo(() => {
        const numPlayers = qualifiers.length;
        if (numPlayers < 2) return 0;
        return 2 ** Math.ceil(Math.log2(numPlayers));
    }, [qualifiers]);

    const [firstRoundAssignments, setFirstRoundAssignments] = useState<(string | null)[]>([]);

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

    // Funzione per generare il tabellone (implementa la logica firestore secondo il tuo progetto)
    const handleGenerateBracket = () => {
        // Qui salvi il bracket su firestore/torneo
        console.log("Genera playoff bracket", firstRoundAssignments);
        alert("Tabellone playoff generato! (collega qui il salvataggio Firestore)");
    };

    const unassignedPlayers = qualifiers.filter(q => !firstRoundAssignments.includes(q.playerId));
    const numByesAvailable = bracketSize - qualifiers.length;
    const byesAssigned = firstRoundAssignments.filter(a => a === 'BYE').length;

    // Select per assegnazione
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
                        disabled={firstRoundAssignments.some(a => a === null) || qualifiers.length < 2}
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
                            <div className="text-2xl font-bold">{qualifiers.length}</div>
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
