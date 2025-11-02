import React, { useEffect, useState } from 'react';
import { type Event, type Tournament, type Match, type TimeSlot, type Player, type Group } from '../types';
import { updateDoc, doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import MatchList from './MatchList';
import TimeSlots from './TimeSlots';
import StandingsTable from './StandingsTable';
import PlayerManagement from './PlayerManagement';
import ChatPanel from './ChatPanel';
import GroupManagement from './GroupManagement';
import TournamentSettings from './TournamentSettings';
import Playoffs from './Playoffs';
import ConsolationBracket from './ConsolationBracket';

// TournamentView: visualizzazione principale del torneo.
const TournamentView: React.FC<{
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  selectedGroupId?: string;
}> = ({
  event, tournament, setEvents, isOrganizer, loggedInPlayerId, selectedGroupId
}) => {
  // ...Altre logiche e tab invariati...

  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'players' | 'timeSlots' | 'playoffs' | 'consolation' | 'groups' | 'settings' | 'chat'>('standings');

  // --- NUOVO: Slot globali vs slot torneo ---
  // Se ci sono slot globali, usali; altrimenti fallback a quelli torneo.
  const slotsToShow = event.globalTimeSlots && event.globalTimeSlots.length > 0
    ? event.globalTimeSlots
    : tournament.timeSlots;

  // Solo admin può aggiungere/rimuovere slot globali. Gestione solo se sono globali.
  const handleAddGlobalSlot = async (slot: TimeSlot) => {
    if (!isOrganizer) return;
    const updatedSlots = [...(event.globalTimeSlots ?? []), slot].sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, globalTimeSlots: updatedSlots } : ev));
    await updateDoc(doc(db, "events", event.id), {
      globalTimeSlots: updatedSlots
    });
  };

  const handleDeleteGlobalSlot = async (slotId: string) => {
    if (!isOrganizer) return;
    const updatedSlots = (event.globalTimeSlots ?? []).filter(ts => ts.id !== slotId);
    setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, globalTimeSlots: updatedSlots } : ev));
    await updateDoc(doc(db, "events", event.id), {
      globalTimeSlots: updatedSlots
    });
  };

  // --- Fallback: gestione slot specifici torneo (retrocompatibilità) ---
  const handleAddTournamentSlot = async (slot: TimeSlot) => {
    if (!isOrganizer) return;
    const updatedTimeSlots = [...tournament.timeSlots, slot].sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());
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

  const handleDeleteTournamentSlot = async (slotId: string) => {
    if (!isOrganizer) return;
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

  // --- Render tab slot orari: mostra solo gestione admin se ci sono slot globali ---
  const renderTimeSlotsTab = () => (
    <TimeSlots
      event={event}
      tournament={tournament}
      setEvents={setEvents}
      isOrganizer={isOrganizer}
      loggedInPlayerId={loggedInPlayerId}
      selectedGroupId={selectedGroupId}
      // Se ci sono slot globali, mostro quelli e gestisco solo globali, altrimenti gestisco quelli torneo
      isGlobal={event.globalTimeSlots && event.globalTimeSlots.length > 0}
      globalTimeSlots={event.globalTimeSlots}
      handleAddGlobalSlot={handleAddGlobalSlot}
      handleDeleteGlobalSlot={handleDeleteGlobalSlot}
      // Fallback per slot specifici torneo
      handleAddTournamentSlot={handleAddTournamentSlot}
      handleDeleteTournamentSlot={handleDeleteTournamentSlot}
    />
  );

  // --- Tab navigator invariato ---
  return (
    <div>
      <div className="flex gap-2 mb-6">
        {/* ...Altri tab invariati... */}
        <button
          onClick={() => setActiveTab('timeSlots')}
          className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'timeSlots' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
        >
          Slot Orari
        </button>
        {/* ...altri tab... */}
      </div>
      <div>
        {activeTab === 'standings' && <StandingsTable event={event} tournament={tournament} />}
        {activeTab === 'matches' && <MatchList event={event} tournament={tournament} setEvents={setEvents} isOrganizer={isOrganizer} />}
        {activeTab === 'players' && <PlayerManagement event={event} setEvents={setEvents} isOrganizer={isOrganizer} />}
        {activeTab === 'timeSlots' && renderTimeSlotsTab()}
        {activeTab === 'playoffs' && <Playoffs event={event} tournament={tournament} setEvents={setEvents} />}
        {activeTab === 'consolation' && <ConsolationBracket event={event} tournament={tournament} setEvents={setEvents} />}
        {activeTab === 'groups' && <GroupManagement event={event} tournament={tournament} setEvents={setEvents} />}
        {activeTab === 'settings' && isOrganizer && <TournamentSettings event={event} tournament={tournament} setEvents={setEvents} />}
        {activeTab === 'chat' && <ChatPanel />}
      </div>
    </div>
  );
};

export default TournamentView;
