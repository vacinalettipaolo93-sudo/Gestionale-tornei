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
    globalTimeSlots?: TimeSlot[];
}

const TimeSlots: React.FC<TimeSlotsProps> = ({
    event,
    tournament,
    setEvents,
    isOrganizer,
    loggedInPlayerId,
    selectedGroupId,
    globalTimeSlots,
}) => {
    const [newTime, setNewTime] = useState('');
    const [newLocation, setNewLocation] = useState('');

    // Usa slot globali se presenti, altrimenti quelli torneo
    const slotsToShow = globalTimeSlots && globalTimeSlots.length > 0
        ? globalTimeSlots
        : tournament.timeSlots;

    // Solo admin può aggiungere slot globali
    const handleAddSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTime.trim() || !newLocation.trim()) return;
        const newSlot: TimeSlot = {
            id: `ts${Date.now()}`,
            time: new Date(newTime).toISOString(),
            location: newLocation.trim(),
            matchId: null
        };
        if (globalTimeSlots && globalTimeSlots.length > 0) {
            // Slot globali
            const updatedSlots = [...globalTimeSlots, newSlot].sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());
            setEvents(prev =>
              prev.map(ev => ev.id === event.id ? { ...ev, globalTimeSlots: updatedSlots } : ev)
            );
            await updateDoc(doc(db, "events", event.id), {
              globalTimeSlots: updatedSlots
            });
        } else {
            // Slot torneo (retrocompatibilità)
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
        }
    };

    // Solo admin può cancellare slot
    const handleDeleteSlot = async (slotId: string) => {
        if (globalTimeSlots && globalTimeSlots.length > 0) {
            const updatedSlots = globalTimeSlots.filter(ts => ts.id !== slotId);
            setEvents(prev =>
              prev.map(ev => ev.id === event.id ? { ...ev, globalTimeSlots: updatedSlots } : ev)
            );
            await updateDoc(doc(db, "events", event.id), {
              globalTimeSlots: updatedSlots
            });
        } else {
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
        }
    };

    // Funzione per prenotare uno slot (utente)
    const handleBookSlot = async (slot: TimeSlot) => {
        // Logica di prenotazione: aggiorna slot con matchId o utente, a seconda della tua struttura
        // Potresti dover adattare questa funzione in base a come gestisci le prenotazioni (matchId, userId, ecc.)
        alert(`Slot prenotato: ${new Date(slot.time).toLocaleString('it-IT')} - ${slot.location}`);
        // TODO: implementa la tua logica di booking qui, aggiornando Firestore e UI
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
                    {slotsToShow.length > 0 ? slotsToShow.map(slot => (
                        <div key={slot.id} className={`p-3 rounded-lg flex flex-col justify-between items-stretch ${slot.matchId ? 'bg-primary/50' : 'bg-green-500/10 border border-green-500/30'}`}>
                            <div className="mb-2">
                              <p className="font-semibold text-center">{new Date(slot.time).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })}</p>
                              <p className="text-sm text-text-secondary text-center">{slot.location}</p>
                            </div>
                            <div className="flex items-center justify-center gap-3">
                              {isOrganizer && (
                                <button onClick={() => handleDeleteSlot(slot.id)} className="text-text-secondary/50 hover:text-red-500 transition-colors">
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                              )}
                              {!slot.matchId && !isOrganizer && (
                                <button onClick={() => handleBookSlot(slot)} className="bg-accent/80 hover:bg-accent text-primary font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                                    Prenota
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
