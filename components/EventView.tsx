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
        {/* AGGIUNTA: pannello slot globali */}
        <div className="mt-8">
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
