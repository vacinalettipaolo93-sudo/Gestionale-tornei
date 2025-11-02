import React, { useState } from 'react';
import { type Event, type Tournament } from '../types';
import TimeSlots from './TimeSlots';
import StandingsTable from './StandingsTable';
import MatchList from './MatchList';
import PlayerManagement from './PlayerManagement';
import ChatPanel from './ChatPanel';
import GroupManagement from './GroupManagement';
import TournamentSettings from './TournamentSettings';
import Playoffs from './Playoffs';
import ConsolationBracket from './ConsolationBracket';

interface TournamentViewProps {
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  selectedGroupId?: string;
}

const TournamentView: React.FC<TournamentViewProps> = ({
  event, tournament, setEvents, isOrganizer, loggedInPlayerId, selectedGroupId
}) => {
  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'players' | 'timeSlots' | 'playoffs' | 'consolation' | 'groups' | 'settings' | 'chat'>('standings');

  // Usa sempre il torneo attuale
  const slotsToShow = Array.isArray(event.globalTimeSlots) && event.globalTimeSlots.length > 0
    ? event.globalTimeSlots
    : tournament?.timeSlots ?? [];

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {/* ...tab navigator invariato... */}
        <button onClick={() => setActiveTab('standings')} className={`px-4 py-2 rounded-full ${activeTab === 'standings' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}>Classifica</button>
        <button onClick={() => setActiveTab('matches')} className={`px-4 py-2 rounded-full ${activeTab === 'matches' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}>Partite</button>
        <button onClick={() => setActiveTab('players')} className={`px-4 py-2 rounded-full ${activeTab === 'players' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}>Giocatori</button>
        <button onClick={() => setActiveTab('timeSlots')} className={`px-4 py-2 rounded-full ${activeTab === 'timeSlots' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}>Slot Orari</button>
        <button onClick={() => setActiveTab('playoffs')} className={`px-4 py-2 rounded-full ${activeTab === 'playoffs' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}>Playoff</button>
        <button onClick={() => setActiveTab('consolation')} className={`px-4 py-2 rounded-full ${activeTab === 'consolation' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}>Consolation</button>
        <button onClick={() => setActiveTab('groups')} className={`px-4 py-2 rounded-full ${activeTab === 'groups' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}>Gironi</button>
        {isOrganizer && (
          <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-full ${activeTab === 'settings' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}>Impostazioni</button>
        )}
        <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 rounded-full ${activeTab === 'chat' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}>Chat</button>
      </div>
      <div>
        {activeTab === 'standings' && <StandingsTable event={event} tournament={tournament} />}
        {activeTab === 'matches' && <MatchList event={event} tournament={tournament} setEvents={setEvents} isOrganizer={isOrganizer} />}
        {activeTab === 'players' && <PlayerManagement event={event} setEvents={setEvents} isOrganizer={isOrganizer} />}
        {activeTab === 'timeSlots' && (
            <TimeSlots
              event={event}
              tournament={tournament} // <-- sempre torneo valido!
              setEvents={setEvents}
              isOrganizer={isOrganizer}
              loggedInPlayerId={loggedInPlayerId}
              selectedGroupId={selectedGroupId}
              globalTimeSlots={event.globalTimeSlots ?? []}
            />
        )}
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
