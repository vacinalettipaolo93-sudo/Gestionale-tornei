import React, { useState } from 'react';
import { type Event, type Tournament, type TimeSlot } from '../types';
import { TrashIcon } from './Icons';

// FIREBASE IMPORTS
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

interface TimeSlotsProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
    isOrganizer: boolean;
}

const TimeSlots: React.FC<TimeSlotsProps> = ({ event, tournament, setEvents, isOrganizer }) => {
    const [newTime, setNewTime] = useState('');
    const [newLocation, setNewLocation] = useState('');

    // AGGIUNGI SLOT ORARIO IN FIRESTORE
    const handleAddSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTime.trim() || !newLocation.trim()) return;
        
        const newSlot: TimeSlot = {
            id: `ts${Date.now()}`,
            time: new Date(newTime).toISOString(),
            location: newLocation.trim(),
            matchId: null
        };

        const tournamentsUpdated = event.tournaments.map(t => t.id === tournament.id ? {
            ...t,
            timeSlots: [...t.timeSlots, newSlot].sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        } : t);

        await updateDoc(doc(db, "events", event.id), { tournaments: tournamentsUpdated });

        setNewTime('');
        setNewLocation('');
    };

    // ELIMINA SLOT ORARIO DA FIRESTORE
    const handleDeleteSlot = async (slotId: string) => {
        const tournamentsUpdated = event.tournaments.map(t => {
            if (t.id !== tournament.id) return t;
            // Unschedule match if it was using this slot
            const slotToDelete = t.timeSlots.find(ts => ts.id === slotId);
            return {
                ...t,
                timeSlots: t.timeSlots.filter(ts => ts.id !== slotId),
                groups: t.groups.map(g => ({
                    ...g,
                    matches: g.matches.map(m => (slotToDelete && m.scheduledTime === slotToDelete.time)
                        ? { ...m, status: 'pending', scheduledTime: undefined, location: undefined }
                        : m)
                }))
            };
        });

        await updateDoc(doc(db, "events", event.id), { tournaments: tournamentsUpdated });
    };

    const getMatchPlayers = (matchId: string) => {
        for (const group of tournament.groups) {
            const match = group.matches.find(m => m.id === matchId);
            if (match) {
                const p1 = event.players.find(p => p.id === match.player1Id);
                const p2 = event.players.find(p => p.id === match.player2Id);
                return `${p1?.name || '?'} vs ${p2?.name || '?'}`;
            }
        }
        return 'Partita non trovata';
    }

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
                            {isOrganizer && (
                                <button onClick={() => handleDeleteSlot(slot.id)} className="text-text-secondary/50 hover:text-red-500 transition-colors">
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                            )}
                        </div>
                    )) : <p className="text-text-secondary text-center py-4">Nessuno slot orario creato.</p>}
                </div>
            </div>
        </div>
    );
};

export default TimeSlots;