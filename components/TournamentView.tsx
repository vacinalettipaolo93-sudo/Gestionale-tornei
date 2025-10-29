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
import GroupPlayers from './GroupPlayers';

const TournamentView: React.FC<{
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (p: Player) => void;
}> = ({ event, tournament, setEvents, isOrganizer, loggedInPlayerId, onPlayerContact }) => {
  const [activeTab, setActiveTab] = useState<'standings'|'matches'|'players'|'timeSlots'|'chat'|'groupManagement'|'settings'|'playoffs'|'consolation'>('standings');

  // selezione girone e modalità di visualizzazione
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(tournament.groups.length > 0 ? tournament.groups[0].id : null);
  const [viewingOtherGroups, setViewingOtherGroups] = useState(false); // se true l'utente guarda altri gironi (read-only)

  // booking / reschedule / edit result
  const [bookingMatch, setBookingMatch] = useState<Match | null>(null); // flow originario match -> scegli slot
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null); // slot-first flow
  const [rescheduleMatch, setRescheduleMatch] = useState<Match | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // trova girone dell'utente (se esiste)
  const userGroupId = loggedInPlayerId ? tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId))?.id : undefined;

  // all'apertura/metchange: se non organizer e utente iscritto, seleziona il suo girone di default e metti viewingOtherGroups false
  useEffect(() => {
    if (!isOrganizer && loggedInPlayerId) {
      const myGroup = tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId));
      if (myGroup) {
        setSelectedGroupId(myGroup.id);
        setViewingOtherGroups(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.id, loggedInPlayerId, isOrganizer]);

  const selectedGroup: Group | null = selectedGroupId ? (tournament.groups.find(g => g.id === selectedGroupId) ?? null) : null;
  const isViewingOwnGroup = !viewingOtherGroups && !!userGroupId && selectedGroupId === userGroupId;

  // wrapper per aggiornare UI + Firestore
  const handleUpdateEvents = async (updater: (prevEvents: Event[]) => Event[]) => {
    setEvents(updater);
    const updatedEvents = updater([event]);
    const updatedEvent = updatedEvents.find(e => e.id === event.id);
    if (updatedEvent) {
      await updateDoc(doc(db, "events", event.id), updatedEvent);
    }
  };

  // --- (booking/reschedule/cancel/update result) ---
  // Mantieni qui le tue funzioni esistenti (handleBookMatch, handleBookMatchWithSlot, handleRescheduleBookMatch,
  // handleCancelBooking, handleDeleteResult, handleUpdateMatchResult, handleEditResult, handleSaveResult).
  // Le ho omesse qui per brevità ma vanno incollate dal tuo file corrente per mantenere il comportamento.

  const getPlayer = (playerId?: string) => event.players.find(p => p.id === playerId);

  return (
    <div>
      {/* NAV */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('standings')} className={activeTab === 'standings' ? 'font-bold' : ''}>Classifica</button>
        <button onClick={() => setActiveTab('matches')} className={activeTab === 'matches' ? 'font-bold' : ''}>Partite</button>
        <button onClick={() => setActiveTab('players')} className={activeTab === 'players' ? 'font-bold' : ''}>Giocatori</button>
        <button onClick={() => setActiveTab('timeSlots')} className={activeTab === 'timeSlots' ? 'font-bold' : ''}>Slot Orari</button>
        <button onClick={() => setActiveTab('chat')} className={activeTab === 'chat' ? 'font-bold' : ''}>Chat</button>
        {isOrganizer && <button onClick={() => setActiveTab('groupManagement')} className={activeTab === 'groupManagement' ? 'font-bold' : ''}>Gestione Gironi</button>}
        {isOrganizer && <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'font-bold' : ''}>Impostazioni</button>}
        {tournament.playoffs && <button onClick={() => setActiveTab('playoffs')} className={activeTab === 'playoffs' ? 'font-bold' : ''}>Playoffs</button>}
        {tournament.consolationBracket && <button onClick={() => setActiveTab('consolation')} className={activeTab === 'consolation' ? 'font-bold' : ''}>Consolation</button>}
      </div>

      {/* Toggle e select gironi */}
      {!isOrganizer && loggedInPlayerId && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm text-text-secondary">Visualizza altri gironi?</label>
          <button
            onClick={() => setViewingOtherGroups(prev => !prev)}
            className="bg-tertiary/80 hover:bg-tertiary text-text-primary py-1 px-3 rounded"
          >
            {viewingOtherGroups ? 'Disattiva (torna al tuo girone)' : 'Mostra altri gironi (solo risultati)'}
          </button>

          {viewingOtherGroups && (
            <select
              value={selectedGroupId ?? ''}
              onChange={e => setSelectedGroupId(e.target.value || null)}
              className="ml-2 bg-primary border rounded p-1"
            >
              <option value="">-- Scegli girone --</option>
              {tournament.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* organizer: sempre select per switchare girone */}
      {isOrganizer && (
        <div className="mb-4">
          <label className="text-sm text-text-secondary mr-2">Seleziona girone:</label>
          <select value={selectedGroupId ?? ''} onChange={e => setSelectedGroupId(e.target.value || null)} className="bg-primary border rounded p-1">
            {tournament.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}

      <div className="animate-fadeIn space-y-4">
        {/* evidenzia il girone utente se è quello selezionato */}
        {selectedGroup && (
          <div className={`p-3 rounded ${isViewingOwnGroup ? 'border-2 border-green-400 bg-green-50' : 'bg-secondary'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{selectedGroup.name}</div>
                {isViewingOwnGroup && <div className="text-sm text-green-700 font-medium">Il tuo girone</div>}
                {!isViewingOwnGroup && userGroupId && <div className="text-sm text-text-secondary">Stai visualizzando un girone diverso dal tuo (solo risultati se non sei organizer)</div>}
              </div>

              {(isOrganizer || viewingOtherGroups) && (
                <div>
                  <select value={selectedGroupId ?? ''} onChange={e => setSelectedGroupId(e.target.value || null)} className="bg-primary border rounded p-1">
                    {tournament.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'standings' && selectedGroup && (
          <StandingsTable group={selectedGroup} players={event.players} settings={tournament.settings} loggedInPlayerId={loggedInPlayerId} onPlayerContact={onPlayerContact} />
        )}

        {activeTab === 'matches' && selectedGroup && (
          <MatchList
            group={selectedGroup}
            players={event.players}
            onEditResult={handleEditResult}
            onBookMatch={setBookingMatch}
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
            onPlayerContact={onPlayerContact}
            onRescheduleMatch={(m) => setRescheduleMatch(m)}
            onCancelBooking={handleCancelBooking}
            onDeleteResult={handleDeleteResult}
            viewingOwnGroup={isViewingOwnGroup || isOrganizer}
          />
        )}

        {activeTab === 'players' && selectedGroup && (
          // se organizer gestisce con PlayerManagement, altrimenti mostra solo i giocatori del girone (GroupPlayers)
          isOrganizer ? (
            <PlayerManagement event={event} setEvents={setEvents} isOrganizer={isOrganizer} onPlayerContact={onPlayerContact} />
          ) : (
            <GroupPlayers group={selectedGroup} players={event.players} onPlayerContact={onPlayerContact} />
          )
        )}

        {activeTab === 'timeSlots' && (
          <TimeSlots
            event={event}
            tournament={tournament}
            setEvents={setEvents}
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
            selectedGroupId={selectedGroupId ?? undefined}
            onSlotBook={handleSlotInitiatedBooking}
            onRequestReschedule={(m) => setRescheduleMatch(m)}
            onRequestCancelBooking={(m) => handleCancelBooking(m)}
            viewingOwnGroup={isViewingOwnGroup || isOrganizer}
          />
        )}

        {activeTab === 'chat' && <ChatPanel />}

        {activeTab === 'groupManagement' && isOrganizer && <GroupManagement event={event} tournament={tournament} setEvents={setEvents} />}

        {activeTab === 'settings' && isOrganizer && <TournamentSettings event={event} tournament={tournament} setEvents={setEvents} />}

        {activeTab === 'playoffs' && tournament.playoffs && <Playoffs event={event} tournament={tournament} setEvents={setEvents} />}

        {activeTab === 'consolation' && tournament.consolationBracket && <ConsolationBracket event={event} tournament={tournament} setEvents={setEvents} />}
      </div>

      {/* NOTE: ricordati di incollare qui le modals booking/reschedule/slot-first/result dal tuo file originale
          per mantenere tutte le funzionalità già implementate. */}
    </div>
  );
};

export default TournamentView;
