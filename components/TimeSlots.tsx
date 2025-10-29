import React, { useState } from 'react';
import { type Event, type Tournament, type TimeSlot } from '../types';
import { TrashIcon } from './Icons';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface TimeSlotsProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
    isOrganizer: boolean;
    // NUOVI props:
    loggedInPlayerId?: string;
    selectedGroupId?: string;
    onSlotBook?: (slot: TimeSlot) => void;
}

const TimeSlots: React.FC<TimeSlotsProps> = ({ event, tournament, setEvents, isOrganizer, loggedInPlayerId, selectedGroupId, onSlotBook }) => {
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
        // Aggiorna React state
        setEvents(prev => prev.map(ev => ev.id === event.id ? {
            ...ev,
            tournaments: ev.tournaments.map(t => t.id === tournament.id ? {
                ...t,
                timeSlots: updatedTimeSlots
            } : t)
        } : ev));

        // Aggiorna Firestore!
        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, timeSlots: updatedTimeSlots } : t
            )
        });

        setNewTime('');
        setNewLocation('');
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
                return `${p1?.name || '?'} vs ${p2?.name || '?'}`;
            }
        }
        return 'Partita non trovata';
    };

    // trova il girone del giocatore (se esiste)
    const playerGroup = loggedInPlayerId ? tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId)) : undefined;
    // Se selectedGroupId è passato, preferiamolo
    const effectiveGroup = selectedGroupId ? tournament.groups.find(g => g.id === selectedGroupId) : playerGroup;
    const isParticipantInGroup = !!(effectiveGroup && loggedInPlayerId && effectiveGroup.playerIds.includes(loggedInPlayerId));

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
                </div>
            )}
            <div className="bg-secondary p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-accent">Slot Disponibili</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {tournament.timeSlots.length > 0 ? tournament.timeSlots.map(slot => (
                        <div key={slot.id} className={`p-3 rounded-lg flex justify-between items-center ${slot.matchId ? 'bg-primary/50' : 'bg-green-500/10 border border-green-500/30'}`}>
                            <div>
                                <p className="font-semibold">{new Date(slot.time).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })} - {slot.location}</p>
                                <p className={`text-sm ${slot.matchId ? 'text-text-secondary' : 'text-green-400'}`}>{slot.matchId ? `Occupato da: ${getMatchPlayers(slot.matchId)}` : 'Libero'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Pulsante Prenota SOLO se è libero, l'utente è partecipante del girone e onSlotBook è fornito */}
                                {!slot.matchId && onSlotBook && isParticipantInGroup && (
                                    <button onClick={() => onSlotBook(slot)} className="bg-accent/80 hover:bg-accent text-primary font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                                        Prenota
                                    </button>
                                )}
                                {isOrganizer && (
                                    <button onClick={() => handleDeleteSlot(slot.id)} className="text-text-secondary/50 hover:text-red-500 transition-colors">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                )}
                            </div>
                        </div>
                    )) : <p className="text-text-secondary text-center py-4">Nessuno slot orario creato.</p>}
                </div>
            </div>
        </div>
    );
};

export default TimeSlots;
