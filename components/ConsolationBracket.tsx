import React, { useState, useMemo, useEffect } from 'react';
import { type Event, type Tournament, type Player, type PlayoffBracket, type PlayoffMatch } from '../types';
import { calculateStandings } from '../utils/standings';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface ConsolationBracketProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
    isOrganizer: boolean;
    loggedInPlayerId?: string;
}

const ConsolationBracket: React.FC<ConsolationBracketProps> = ({ event, tournament, setEvents, isOrganizer, loggedInPlayerId }) => {
    const [view, setView] = useState<'setup' | 'bracket'>(tournament.consolationBracket?.isGenerated ? 'bracket' : 'setup');
    
    const qualifiers = useMemo(() => {
        const allQualifiers: { playerId: string, rank: number, fromGroup: string, groupName: string }[] = [];
        tournament.groups.forEach(group => {
            const setting = tournament.settings.consolationSettings.find(s => s.groupId === group.id);
            if (setting && setting.startRank > 0 && setting.endRank >= setting.startRank) {
                const standings = calculateStandings(group, event.players, tournament.settings);
                const groupQualifiers = standings.slice(setting.startRank - 1, setting.endRank).map((entry, index) => ({
                    playerId: entry.playerId,
                    rank: setting.startRank + index,
                    fromGroup: group.id,
                    groupName: group.name,
                }));
                allQualifiers.push(...groupQualifiers);
            }
        });
        return allQualifiers;
    }, [tournament, event.players]);

    const bracketSize = useMemo(() => {
        const numPlayers = qualifiers.length;
        if (numPlayers < 2) return 0;
        return 2 ** Math.ceil(Math.log2(numPlayers));
    }, [qualifiers]);
    
    const [firstRoundAssignments, setFirstRoundAssignments] = useState<(string | null)[]>([]);
    const [editingMatch, setEditingMatch] = useState<PlayoffMatch | null>(null);
    const [score1, setScore1] = useState('');
    const [score2, setScore2] = useState('');
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);

    useEffect(() => {
        if (view === 'setup') {
            setFirstRoundAssignments(Array(bracketSize).fill(null));
        }
    }, [qualifiers, view, bracketSize]);

    const getPlayer = (id: string | null): Player | null => id ? event.players.find(p => p.id === id) ?? null : null;
    
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

    // GENERA BRACKET E SALVA SU FIRESTORE
    const handleGenerateBracket = async () => {
        if (firstRoundAssignments.some(a => a === null)) {
            alert("Per favore, riempi tutti gli slot del primo turno.");
            return;
        }

        const newMatches: PlayoffMatch[] = [];
        const numRounds = Math.log2(bracketSize);
        let matchCounter = 0;
        
        for (let round = 1; round <= numRounds; round++) {
            const matchesInRound = bracketSize / (2 ** round);
            for (let i = 0; i < matchesInRound; i++) {
                newMatches.push({
                    id: `con-m-${matchCounter}`, round, matchIndex: matchCounter,
                    player1Id: null, player2Id: null, score1: null, score2: null,
                    winnerId: null, nextMatchId: null,
                });
                matchCounter++;
            }
        }
        
        newMatches.forEach(match => {
            if (match.round < numRounds) {
                const roundMatches = newMatches.filter(m => m.round === match.round);
                const matchIndexInRound = roundMatches.findIndex(m => m.id === match.id);
                const nextRoundMatches = newMatches.filter(m => m.round === match.round + 1);
                const nextMatch = nextRoundMatches[Math.floor(matchIndexInRound / 2)];
                if (nextMatch) match.nextMatchId = nextMatch.id;
            }
        });
        
        const firstRoundMatches = newMatches.filter(m => m.round === 1);
        firstRoundMatches.forEach((match, i) => {
            const p1Id = firstRoundAssignments[i * 2];
            const p2Id = firstRoundAssignments[i * 2 + 1];
            const isP1Bye = p1Id === 'BYE';
            const isP2Bye = p2Id === 'BYE';
            match.player1Id = isP1Bye ? null : p1Id;
            match.player2Id = isP2Bye ? null : p2Id;
            let winnerId = null;
            if (!isP1Bye && isP2Bye) winnerId = p1Id;
            if (isP1Bye && !isP2Bye) winnerId = p2Id;
            
            if (winnerId) {
                match.winnerId = winnerId;
                const nextMatch = newMatches.find(m => m.id === match.nextMatchId);
                if (nextMatch) {
                    const matchIndexInRound = firstRoundMatches.findIndex(m => m.id === match.id);
                    if (matchIndexInRound % 2 === 0) nextMatch.player1Id = winnerId;
                    else nextMatch.player2Id = winnerId;
                }
            }
        });
        
        const finalBracket: PlayoffBracket = {
            matches: newMatches, isGenerated: true,
            finalId: newMatches.find(m => m.round === numRounds)?.id ?? null,
            bronzeFinalId: null,
        };

        setEvents(prev => prev.map(e => e.id === event.id ? { ...e, tournaments: e.tournaments.map(t => t.id === tournament.id ? { ...t, consolationBracket: finalBracket } : t) } : e));
        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, consolationBracket: finalBracket } : t
            )
        });
        setView('bracket');
    };

    // RESET BRACKET E SALVA SU FIRESTORE
    const handleResetBracket = async () => {
        setEvents(prev => prev.map(e => e.id === event.id ? { ...e, tournaments: e.tournaments.map(t => t.id === tournament.id ? { ...t, consolationBracket: { ...(t.consolationBracket!), isGenerated: false, matches: [], finalId: null, bronzeFinalId: null, } } : t) } : e));
        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, consolationBracket: { ...(t.consolationBracket!), isGenerated: false, matches: [], finalId: null, bronzeFinalId: null, } } : t
            )
        });
        setView('setup');
        setIsResetModalOpen(false);
    };

    // SALVA RISULTATO MATCH E AGGIORNA FIRESTORE
    const handleSaveResult = async () => {
        if (!editingMatch) return;
        const s1 = parseInt(score1, 10);
        const s2 = parseInt(score2, 10);
        if (isNaN(s1) || isNaN(s2)) return;

        setEvents(prevEvents => {
            const newEvents = JSON.parse(JSON.stringify(prevEvents));
            const currentTournament = newEvents.find((e: Event) => e.id === event.id)!.tournaments.find((t: Tournament) => t.id === tournament.id)!;
            const bracket = currentTournament.consolationBracket!;
            const match = bracket.matches.find((m: PlayoffMatch) => m.id === editingMatch.id)!;
            match.score1 = s1;
            match.score2 = s2;
            const winnerId = s1 > s2 ? match.player1Id : match.player2Id;
            match.winnerId = winnerId;

            if (match.nextMatchId) {
                const nextMatch = bracket.matches.find((m: PlayoffMatch) => m.id === match.nextMatchId)!;
                const allMatchesInRound = bracket.matches.filter((m: PlayoffMatch) => m.round === match.round).sort((a:PlayoffMatch, b:PlayoffMatch) => a.matchIndex - b.matchIndex);
                const matchIndexInRound = allMatchesInRound.findIndex((m:PlayoffMatch) => m.id === match.id);
                if (matchIndexInRound % 2 === 0) nextMatch.player1Id = winnerId;
                else nextMatch.player2Id = winnerId;
            }
            return newEvents;
        });

        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, consolationBracket: (() => {
                    const bracketCopy = { ...t.consolationBracket! };
                    const match = bracketCopy.matches.find((m: PlayoffMatch) => m.id === editingMatch.id)!;
                    match.score1 = s1;
                    match.score2 = s2;
                    match.winnerId = s1 > s2 ? match.player1Id : match.player2Id;
                    return bracketCopy;
                })() } : t
            )
        });

        setEditingMatch(null); setScore1(''); setScore2('');
    };

    // SETUP VIEW
    if (view === 'setup') {
        if (!isOrganizer) return <p className="text-text-secondary text-center">Il tabellone di consolazione non è stato ancora generato.</p>;
        
        const unassignedPlayers = qualifiers.filter(q => !firstRoundAssignments.includes(q.playerId));
        const numByesAvailable = bracketSize - qualifiers.length;
        const byesAssigned = firstRoundAssignments.filter(a => a === 'BYE').length;

        const AssignmentSlot = ({ slotIndex }: { slotIndex: number }) => {
            const currentValue = firstRoundAssignments[slotIndex];
            const currentPlayer = getPlayer(currentValue);
            return (
                 <select
                    value={currentValue ?? ''}
                    onChange={(e) => handleAssignmentChange(slotIndex, e.target.value)}
                    className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
                >
                    <option value="">-- Seleziona --</option>
                    {currentValue && currentValue !== 'BYE' && <option value={currentValue}>{currentPlayer?.name}</option>}
                    {unassignedPlayers
                        .slice()
                        .sort((a, b) => {
                            const playerA = getPlayer(a.playerId);
                            const playerB = getPlayer(b.playerId);
                            return (playerA?.name || '').localeCompare(playerB?.name || '');
                        })
                        .map(p => (
                        <option key={p.playerId} value={p.playerId}>{getPlayer(p.playerId)?.name}</option>
                    ))}
                    {(byesAssigned < numByesAvailable || currentValue === 'BYE') && <option value="BYE">-- BYE --</option>}
                </select>
            );
        };
        
        return (
            <div className="bg-secondary p-6 rounded-xl shadow-lg max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <h3 className="text-xl font-bold mb-2 text-accent">Costruttore Tabellone Consolazione</h3>
                    <p className="text-text-secondary mb-6">Assegna manualmente i giocatori qualificati agli slot del primo turno.</p>
                    
                    <div className="space-y-4">
                        {bracketSize > 0 ? Array.from({ length: bracketSize / 2 }).map((_, index) => (
                             <div key={index} className="bg-primary/50 p-4 rounded-lg flex items-center gap-4">
                                <span className="font-bold text-text-secondary">M{index+1}</span>
                                <div className="flex-1"><AssignmentSlot slotIndex={index * 2} /></div>
                                <span className="text-tertiary">vs</span>
                                <div className="flex-1"><AssignmentSlot slotIndex={index * 2 + 1} /></div>
                            </div>
                        )) : <p className="text-text-secondary">Nessun giocatore qualificato per il tabellone di consolazione.</p>}
                    </div>

                    <div className="mt-8">
                         <button onClick={handleGenerateBracket} disabled={firstRoundAssignments.some(a => a === null) || qualifiers.length < 2} className="w-full bg-highlight hover:bg-highlight/90 text-white font-bold py-2 px-4 rounded-lg transition-colors text-lg">
                            Genera Tabellone
                        </button>
                    </div>
                </div>
                <div className="sticky top-4">
                    <h4 className="font-semibold text-xl mb-4 text-accent">Riepilogo</h4>
                    <div className="bg-primary/50 p-4 rounded-lg mb-6">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div><div className="text-2xl font-bold">{qualifiers.length}</div><div className="text-sm text-text-secondary">Qualificati</div></div>
                            <div><div className="text-2xl font-bold">{bracketSize}</div><div className="text-sm text-text-secondary">Posti</div></div>
                            <div><div className="text-2xl font-bold">{numByesAvailable}</div><div className="text-sm text-text-secondary">Bye</div></div>
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
                                    <img src={player?.avatar} alt={player?.name} className="w-8 h-8 rounded-full" />
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
    }
    
    // RENDER BRACKET
    const { matches } = tournament.consolationBracket!;
    const maxRound = Math.max(0, ...matches.map(m => m.round));
    
    const getRoundName = (round: number) => {
        if (round === maxRound) return "Finale";
        if (round === maxRound - 1) return "Semifinali";
        return `Turno ${round}`;
    };

    const PlayerInMatch = ({ player, winnerId }: { player: Player | null; winnerId: string | null }) => {
        if (!player) return <span className="text-text-secondary">TBD</span>;
        const isWinner = winnerId === player.id;
        const isLoser = winnerId !== null && !isWinner;
        const isLoggedUser = player.id === loggedInPlayerId;

        return (
            <span className={`truncate ${isWinner ? 'font-bold text-text-primary' : isLoser ? 'text-text-secondary/70 line-through' : 'text-text-secondary'} ${isLoggedUser ? 'text-accent font-bold' : ''}`}>
                {player.name}
            </span>
        );
    };

    const MatchCard = ({ match }: { match: PlayoffMatch; }) => {
        const p1 = getPlayer(match.player1Id);
        const p2 = getPlayer(match.player2Id);
        const canEdit = isOrganizer && match.player1Id && match.player2Id && match.winnerId === null;
        
        return (
            <div className={`bg-secondary p-2 rounded-lg w-full`}>
                <div className="flex justify-between items-center text-sm">
                    <PlayerInMatch player={p1} winnerId={match.winnerId} />
                    {match.score1 !== null && <span className={`font-bold ${match.winnerId === p1?.id ? 'text-accent' : 'text-text-primary'}`}>{match.score1}</span>}
                </div>
                 <div className="border-t border-tertiary/50 my-1"></div>
                 <div className="flex justify-between items-center text-sm">
                    <PlayerInMatch player={p2} winnerId={match.winnerId} />
                    {match.score2 !== null && <span className={`font-bold ${match.winnerId === p2?.id ? 'text-accent' : 'text-text-primary'}`}>{match.score2}</span>}
                </div>
                {canEdit && (
                    <div className="text-center mt-2">
                        <button onClick={() => { setEditingMatch(match); setScore1(match.score1?.toString() ?? ''); setScore2(match.score2?.toString() ?? ''); }} className="text-xs bg-highlight/80 hover:bg-highlight text-white px-3 py-1 rounded-lg font-bold">Inserisci Risultato</button>
                    </div>
                )}
            </div>
        )
    };

    const finalMatch = matches.find(m => m.round === maxRound);
    const winner = finalMatch?.winnerId ? getPlayer(finalMatch.winnerId) : null;
    
    return (
        <div className="bg-secondary p-2 md:p-6 rounded-xl shadow-lg">
             <div className="text-center mb-6">
                 <h3 className="text-2xl font-bold text-accent">Tabellone di Consolazione</h3>
                 {winner && <div className="mt-2 text-lg text-yellow-400 font-bold animate-subtlePulse">
🏆 Vincitore: {winner.name} 🏆</div>}
                 {isOrganizer && <button onClick={() => setIsResetModalOpen(true)} className="mt-2 text-sm text-yellow-500 hover:text-yellow-400 underline">Modifica Tabellone</button>}
             </div>
             <div className="flex justify-start items-stretch gap-4 md:gap-10 overflow-x-auto pb-4 px-2">
                {Array.from({ length: maxRound }).map((_, i) => {
                    const roundNum = i + 1;
                    const roundMatches = matches.filter(m => m.round === roundNum).sort((a,b) => a.matchIndex - b.matchIndex);
                    if (roundMatches.length === 0) return null;
                    return(
                    <div key={i} className="flex flex-col w-60 flex-shrink-0 justify-around">
                        <h4 className="text-lg font-semibold text-center text-text-secondary mb-4">{getRoundName(roundNum)}</h4>
                        <div className="space-y-10">
                            {roundMatches.map(match => (
                                <div key={match.id} className="relative">
                                    <MatchCard match={match}/>
                                    {match.nextMatchId && (
                                    <div className="absolute top-1/2 -right-5 md:-right-8 w-5 md:w-8 h-px bg-tertiary z-0">
                                        <div className="absolute top-1/2 -right-px w-px h-10 md:h-12 bg-tertiary" style={{transform: `translateY(${match.matchIndex % 2 === 0 ? '-100%' : '0'})`}}></div>
                                    </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )})}
                 {/* Champion Column */}
                 <div className="flex flex-col w-60 flex-shrink-0 justify-center items-center">
                    <h4 className="text-lg font-semibold text-center text-text-secondary mb-4">Campione</h4>
                    {finalMatch ? <MatchCard match={finalMatch} /> : null}
                 </div>
             </div>

             {isOrganizer && editingMatch && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-sm border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Risultato Consolazione</h4>
                        <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold">{getPlayer(editingMatch.player1Id)?.name}</span>
                        <div className="flex gap-2">
                            <input type="number" value={score1} onChange={e => setScore1(e.target.value)} className="w-16 text-center bg-primary p-2 rounded-lg" />
                            <span>-</span>
                            <input type="number" value={score2} onChange={e => setScore2(e.target.value)} className="w-16 text-center bg-primary p-2 rounded-lg" />
                        </div>
                        <span className="font-semibold">{getPlayer(editingMatch.player2Id)?.name}</span>
                        </div>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => setEditingMatch(null)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Annulla</button>
                            <button onClick={handleSaveResult} className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-4 rounded-lg transition-colors">Salva</button>
                        </div>
                    </div>
                </div>
            )}
            {isOrganizer && isResetModalOpen && (
                 <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
                        <h4 className="text-lg font-bold mb-4">Conferma Reset</h4>
                        <p className="text-text-secondary">Sei sicuro di voler resettare il tabellone di consolazione? Tutti i risultati verranno persi.</p>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => setIsResetModalOpen(false)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Annulla</button>
                            <button onClick={handleResetBracket} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Resetta</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsolationBracket;
