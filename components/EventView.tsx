import React, { useState } from 'react';
import { type Event, type Tournament, type TimeSlot } from '../types';
import { TrophyIcon, UsersIcon, PlusIcon, TrashIcon } from './Icons';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";
import TimeSlots from './TimeSlots';

interface EventViewProps {
  event: Event;
  onSelectTournament: (tournament: Tournament) => void;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
}

const EventView: React.FC<EventViewProps> = ({ event, onSelectTournament, setEvents, isOrganizer }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);

  // AGGIUNTA: gestisci slot globali
  const handleAddGlobalSlot = async (slot: TimeSlot) => {
    const updatedSlots = [...(event.globalTimeSlots ?? []), slot].sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    setEvents(prev =>
      prev.map(ev => ev.id === event.id ? { ...ev, globalTimeSlots: updatedSlots } : ev)
    );
    await updateDoc(doc(db, "events", event.id), {
      globalTimeSlots: updatedSlots
    });
  };

  const handleDeleteGlobalSlot = async (slotId: string) => {
    const updatedSlots = (event.globalTimeSlots ?? []).filter(ts => ts.id !== slotId);
    setEvents(prev =>
      prev.map(ev => ev.id === event.id ? { ...ev, globalTimeSlots: updatedSlots } : ev)
    );
    await updateDoc(doc(db, "events", event.id), {
      globalTimeSlots: updatedSlots
    });
  };

  // ...gestione tornei invariata...

  return (
    <div className="space-y-8">
      <div className="bg-secondary p-6 rounded-xl shadow-lg">
        <div className="flex flex-col md:flex-row justify-between md:items-center">
          <h2 className="text-3xl font-bold text-white mb-2 md:mb-0">{event.name}</h2>
          {isOrganizer && (
            <div className="flex items-center gap-2 bg-primary p-2 rounded-lg">
              {/* ... altri controlli admin ... */}
            </div>
          )}
        </div>
        {/* Lista Tornei (come prima) */}
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4 text-accent">Tornei</h3>
          {event.tournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {event.tournaments.map(tournament => (
                <div key={tournament.id} className="bg-primary p-4 rounded-lg shadow-md flex flex-col gap-2">
                  <h4 className="text-lg font-bold">{tournament.name}</h4>
                  <button
                    className="bg-highlight text-white py-2 px-4 rounded-lg font-bold transition-colors"
                    onClick={() => onSelectTournament(tournament)}
                  >
                    Gestisci
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-center py-4">Nessun torneo creato.</p>
          )}
        </div>
        {/* SEZIONE SLOT GLOBALI SOTTO LA LISTA TORNEI */}
        <div className="mt-12">
          <TimeSlots
            event={event}
            tournament={undefined as any} // slot globali non sono legati ad un torneo
            setEvents={setEvents}
            isOrganizer={isOrganizer}
            loggedInPlayerId={undefined}
            selectedGroupId={undefined}
            onSlotBook={undefined}
            onRequestReschedule={undefined}
            onRequestCancelBooking={undefined}
            viewingOwnGroup={false}
            isGlobal // <-- aggiungi questa prop per distinguere i global slot
            handleAddGlobalSlot={handleAddGlobalSlot}
            handleDeleteGlobalSlot={handleDeleteGlobalSlot}
            globalTimeSlots={event.globalTimeSlots ?? []}
          />
        </div>
        {/* ...continua gestione tornei come prima... */}
      </div>
      {/* ...modali gestione torneo invariati... */}
    </div>
  );
};

export default EventView;
