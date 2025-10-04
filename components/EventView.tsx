import React, { useState } from 'react';
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { type Event, type Tournament } from '../types';
import PlayerManagement from './PlayerManagement';

interface EventViewProps {
  event: Event;
  onSelectTournament: (tournament: Tournament) => void;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
}

const EventView: React.FC<EventViewProps> = ({ event, onSelectTournament, setEvents, isOrganizer }) => {
  const [newTournamentName, setNewTournamentName] = useState('');

  // AGGIUNGI TORNEO ALL'EVENTO
  const handleAddTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTournamentName.trim()) return;

    // Usa sempre event.id come ID del documento (generato da Firestore)
    const newTournament: Tournament = {
      id: `t${Date.now()}`,
      name: newTournamentName.trim(),
      groups: [],
      status: "open",
    };
    const updatedTournaments = [...event.tournaments, newTournament];
    await updateDoc(doc(db, "events", event.id), {
      tournaments: updatedTournaments,
    });
    setNewTournamentName('');
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-accent">{event.name}</h2>
        <span className="text-text-secondary font-mono">Codice: <strong>{event.invitationCode}</strong></span>
      </div>
      <PlayerManagement
        event={event}
        setEvents={setEvents}
        isOrganizer={isOrganizer}
        onPlayerContact={() => {}}
      />
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Tornei</h3>
          {isOrganizer && (
            <form onSubmit={handleAddTournament} className="flex gap-2">
              <input
                type="text"
                placeholder="Nome torneo"
                value={newTournamentName}
                onChange={e => setNewTournamentName(e.target.value)}
                className="bg-secondary border border-tertiary rounded-lg p-2 text-text-primary"
              />
              <button type="submit" className="bg-highlight hover:bg-highlight/90 text-white font-bold py-2 px-4 rounded-lg">Aggiungi</button>
            </form>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {event.tournaments.map(tournament => (
            <div key={tournament.id} className="bg-tertiary rounded-lg p-4 shadow cursor-pointer transition hover:bg-secondary"
                 onClick={() => onSelectTournament(tournament)}>
              <h4 className="font-bold text-accent">{tournament.name}</h4>
              <p className="text-text-secondary text-sm">{tournament.groups.length} gironi</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventView;