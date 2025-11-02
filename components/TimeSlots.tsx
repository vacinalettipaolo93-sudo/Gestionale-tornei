import React, { useState } from 'react';
import { type Event, type Tournament, type TimeSlot, type Match } from '../types';
import { TrashIcon } from './Icons';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface TimeSlotsProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
    isOrganizer: boolean;
    loggedInPlayerId?: string;
    selectedGroupId?: string;
    onSlotBook?: (slot: TimeSlot) => void;
    onRequestReschedule?: (match: Match) => void;
    onRequestCancelBooking?: (match: Match) => void;
    viewingOwnGroup?: boolean; // true se l'utente sta guardando il proprio girone
}

const TimeSlots: React.FC<TimeSlotsProps> = ({ event, tournament, setEvents, isOrganizer, loggedInPlayerId, selectedGroupId, onSlotBook, onRequestReschedule, onRequestCancelBooking, viewingOwnGroup }) => {
    // manteniamo i valori inseriti per riuso (l'amministratore vedrà gli ultimi inseriti nel form dopo "Aggiungi")
    const [newTime, setNewTime] = useState('');
    const [newLocation, setNewLocation] = useState('');

    const handleAddSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTime.trim() || !newLocation.trim()) return;

        const newSlot: TimeSlot = {
            id: `ts${Date.now()}`,
            time: new Date(newTime).toISOString(),
            location: newLocation.trim(),
            matchId: null
        };

        const updatedTimeSlots = [...tournament.timeSlots, newSlot].sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        setEvents(prev => prev.map(ev => ev.id === event.id ? {
            ...ev,
            tournaments: ev.tournaments.map(t => t.id === tournament.id ? { ...t, timeSlots: updatedTimeSlots } : t)
        } : ev));

        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, timeSlots: updatedTimeSlots } : t
            )
        });

        // do NOT clear inputs: admin wants them preserved for faster additions
    };

    const handleDeleteSlot = async (slotId: string) => {
        const updatedTimeSlots = tournament.timeSlots.filter(ts => ts.id !== slotId);
        setEvents(prev => prev.map(ev => ev.id === event.id ? {
            ...ev,
            tournaments: ev.tournaments.map(t => t.id === tournament.id ? { ...t, timeSlots: updatedTimeSlots } : t)
        } : ev));
        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, timeSlots: updatedTimeSlots } : t
            )
        });
    };

    const getMatchPlayers = (matchId?: string | null) => {
        if (!matchId) return '';
        for (const group of tournament.groups) {
            const match = group.matches.find(m => m.id === matchId);
            if (match) {
                const p1 = event.players.find(p => p.id === match.player1Id);
                const p2 = event.players.find(p => p.id === match.player2Id);
                if (match.score1 != null && match.score2 != null) {
                  return `${p1?.name || '?'} ${match.score1} - ${match.score2} ${p2?.name || '?'}`;
                }
                return `${p1?.name || '?'} vs ${p2?.name || '?'}`;
            }
        }
        return 'Partita non trovata';
    };

    const getMatchScore = (matchId?: string | null) => {
      if (!matchId) return null;
      for (const group of tournament.groups) {
        const match = group.matches.find(m => m.id === matchId);
        if (match && match.score1 != null && match.score2 != null) {
          return `${match.score1} — ${match.score2}`;
        }
      }
      return null;
    };

    // trova girone dell'utente
    const playerGroup = loggedInPlayerId ? tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId)) : undefined;
    const effectiveGroup = selectedGroupId ? tournament.groups.find(g => g.id === selectedGroupId) : playerGroup;
    const isParticipantInGroup = !!(effectiveGroup && loggedInPlayerId && effectiveGroup.playerIds.includes(loggedInPlayerId));

    const findMatchById = (matchId?: string | null) : Match | undefined => {
        if (!matchId) return undefined;
        for (const g of tournament.groups) {
            const m = g.matches.find(x => x.id === matchId);
            if (m) return m;
        }
        return undefined;
    };

    return (
        <div className="space-y-6">
            {isOrganizer && (
                <div className="bg-secondary p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-accent">Aggiungi Slot Orario</h3>
                    <form onSubmit={handleAddSlot} className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="datetime-local"
                            value={newTime}
                            onChange={e => setNewTime(e.target.value)}
                            className="flex-grow bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Luogo (es. Campo 1)"
                            value={newLocation}
                            onChange={e => setNewLocation(e.target.value)}
                            className="flex-grow bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
                            required
                        />
                        <button type="submit" className="bg-highlight hover:bg-highlight/90 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                            Aggiungi
                        </button>
                    </form>

                    <p className="text-sm text-text-secondary mt-2">
                      Nota: il sistema manterrà l'ultimo orario e luogo inseriti, così puoi crearne rapidamente altri simili.
                    </p>
                </div>
            )}
            <div className="bg-secondary p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-accent">Slot Disponibili</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {tournament.timeSlots.length > 0 ? tournament.timeSlots.map(slot => {
                        const match = findMatchById(slot.matchId);
                        const isParticipantOfThisMatch = !!(match && loggedInPlayerId && (match.player1Id === loggedInPlayerId || match.player2Id === loggedInPlayerId));
                        const canManageThisSlot = isOrganizer || (isParticipantOfThisMatch && !!viewingOwnGroup);
                        const scoreCenter = getMatchScore(slot.matchId);
                        return (
                        <div key={slot.id} className={`p-3 rounded-lg flex flex-col justify-between items-stretch ${slot.matchId ? 'bg-primary/50' : 'bg-green-500/10 border border-green-500/30'}`}>
                            <div className="mb-2">
                              <p className="font-semibold text-center">{new Date(slot.time).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })}</p>
                              <p className="text-sm text-text-secondary text-center">{slot.location}</p>
                            </div>

                            <div className="flex items-center justify-center mb-2">
                              {scoreCenter ? (
                                <div className="text-2xl font-bold text-center">{scoreCenter}</div>
                              ) : slot.matchId && match ? (
                                <div className="text-center text-sm text-text-primary">{getMatchPlayers(slot.matchId)}</div>
                              ) : (
                                <div className="text-center text-green-400">Libero</div>
                              )}
                            </div>

                            <div className="flex items-center justify-center gap-3">
                                {!slot.matchId && onSlotBook && isParticipantInGroup && viewingOwnGroup && (
                                    <button onClick={() => onSlotBook(slot)} className="bg-accent/80 hover:bg-accent text-primary font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                                        Prenota
                                    </button>
                                )}

                                {slot.matchId && canManageThisSlot && match && (
                                    <>
                                        {onRequestReschedule && (
                                            <button onClick={() => onRequestReschedule(match)} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                                                Modifica pren.
                                            </button>
                                        )}
                                        {onRequestCancelBooking && (
                                            <button onClick={() => onRequestCancelBooking(match)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                                                Annulla pren.
                                            </button>
                                        )}
                                    </>
                                )}

                                {isOrganizer && (
                                    <button onClick={() => handleDeleteSlot(slot.id)} className="text-text-secondary/50 hover:text-red-500 transition-colors">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}) : <p className="text-text-secondary text-center py-4">Nessuno slot orario creato.</p>}
                </div>
            </div>
        </div>
    );
};

export default TimeSlots;
