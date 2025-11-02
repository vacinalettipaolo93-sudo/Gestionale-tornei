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

  return (
    <div className="space-y-8">
      <div className="bg-secondary p-6 rounded-xl shadow-lg">
        {/* Codice invito e bottone aggiungi torneo */}
        <div className="flex flex-col md:flex-row justify-between md:items-center">
          <h2 className="text-3xl font-bold text-white mb-2 md:mb-0">{event.name}</h2>
          <div className="flex items-center gap-4">
            <div className="bg-tertiary text-text-primary px-4 py-2 rounded-lg font-bold">
              Codice Invito: <span className="text-accent">{event.invitationCode}</span>
            </div>
            {isOrganizer && (
              <button className="bg-highlight text-white font-bold py-2 px-4 rounded-lg transition-colors"
                onClick={() => setIsModalOpen(true)}>
                <PlusIcon className="w-5 h-5 mr-2" /> Aggiungi Torneo
              </button>
            )}
          </div>
        </div>
        {/* Lista Tornei */}
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4 text-accent">Tornei</h3>
          {event.tournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {event.tournaments.map(tournament => (
                <div key={tournament.id} className="bg-primary p-4 rounded-lg shadow-md flex flex-col gap-2">
                  {/* Info torneo: gironi, progress, partite, ecc. */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-white">{tournament.name}</span>
                    {isOrganizer && (
                      <button className="text-text-secondary/50 hover:text-red-500 transition-colors"
                        onClick={() => setTournamentToDelete(tournament)}>
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  {/* Qui puoi aggiungere info su gironi/partite se vuoi */}
                  <button
                    className="bg-accent/70 hover:bg-accent text-white py-2 px-4 rounded-lg font-bold transition-colors"
                    onClick={() => onSelectTournament(tournament)}
                  >
                    Visualizza Torneo
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-center py-4">Nessun torneo creato.</p>
          )}
        </div>
        {/* SLOT ORARI GLOBALI SOTTO LA LISTA TORNEI */}
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
        {/* ...modali gestione torneo invariati... */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-sm border border-tertiary">
              <h4 className="text-lg font-bold mb-4">Aggiungi Nuovo Torneo</h4>
              <form onSubmit={
                async (e) => {
                  e.preventDefault();
                  if(!newTournamentName.trim()) return;
                  const newTournament: Tournament = {
                    id: `trn${Date.now()}`,
                    name: newTournamentName.trim(),
                    groups: [],
                    settings: { /* default settings */ },
                    timeSlots: [],
                    playoffs: null,
                    consolationBracket: null
                  };
                  const updatedTournaments = [...event.tournaments, newTournament];
                  setEvents(prevEvents => prevEvents.map(ev => ev.id === event.id ? { ...ev, tournaments: updatedTournaments } : ev));
                  await updateDoc(doc(db, "events", event.id), { tournaments: updatedTournaments });
                  setNewTournamentName('');
                  setIsModalOpen(false);
                }
              }>
                <input
                  type="text"
                  placeholder="Nome del torneo"
                  value={newTournamentName}
                  onChange={e => setNewTournamentName(e.target.value)}
                  className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-accent"
                  autoFocus
                />
                <div className="flex justify-end gap-4 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">
                    Annulla
                  </button>
                  <button type="submit"
                    className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    Aggiungi Torneo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modale elimina torneo */}
        {tournamentToDelete && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
              <h4 className="text-lg font-bold mb-4">Conferma Eliminazione</h4>
              <p className="text-text-secondary">Sei sicuro di voler eliminare il torneo "{tournamentToDelete.name}"?</p>
              <div className="flex justify-end gap-4 mt-6">
                <button onClick={() => setTournamentToDelete(null)}
                  className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Annulla</button>
                <button onClick={
                  async () => {
                    const updatedTournaments = event.tournaments.filter(t => t.id !== tournamentToDelete.id);
                    setEvents(prevEvents => prevEvents.map(ev => ev.id === event.id ? { ...ev, tournaments: updatedTournaments } : ev));
                    await updateDoc(doc(db, "events", event.id), { tournaments: updatedTournaments });
                    setTournamentToDelete(null);
                  }
                }
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Elimina</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventView;
