import React, { useState, useMemo, useEffect } from 'react';
import { type Event, type Tournament, type Player, type Match, type Group, type TimeSlot } from '../types';
import StandingsTable from './StandingsTable';
import MatchList from './MatchList';
import PlayerManagement from './PlayerManagement';
import ChatPanel from './ChatPanel';
import GroupManagement from './GroupManagement';
import TournamentSettings from './TournamentSettings';
import TimeSlots from './TimeSlots';
import Playoffs from './Playoffs';
import ConsolationBracket from './ConsolationBracket';
import { PlusIcon } from './Icons';
import { db } from "../firebase";
import { updateDoc, doc, runTransaction } from "firebase/firestore";

interface TournamentViewProps {
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (player: Player) => void;
}

type Tab = 'standings' | 'matches' | 'players' | 'groupManagement' | 'settings' | 'timeSlots' | 'playoffs' | 'consolation' | 'chat';

const TournamentView: React.FC<TournamentViewProps> = ({
  event,
  tournament,
  setEvents,
  isOrganizer,
  loggedInPlayerId,
  onPlayerContact,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('standings');

  const playerGroup = useMemo(() => {
    if (loggedInPlayerId) {
      return tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId));
    }
    return tournament.groups[0];
  }, [tournament, loggedInPlayerId]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(playerGroup?.id);

  useEffect(() => {
    if (!isOrganizer && loggedInPlayerId) {
      const theirGroup = tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId));
      if (theirGroup) {
        setSelectedGroupId(theirGroup.id);
        setActiveTab('standings');
      }
    } else if (tournament.groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(tournament.groups[0].id);
    }
  }, [loggedInPlayerId, isOrganizer, tournament.groups, selectedGroupId]);

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [bookingMatch, setBookingMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const selectedGroup = tournament.groups.find(g => g.id === selectedGroupId);

  // Stato per la partita da riprenotare (cambia slot)
  const [rescheduleMatch, setRescheduleMatch] = useState<Match | null>(null);

  // Stato per la prenotazione slot-first
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null);

  // Calcola il girone e le partite disponibili per la prenotazione slot-first
  const slotBookingData = useMemo(() => {
    if (!bookingSlot || !loggedInPlayerId) return null;
    
    const playerGroup = tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId));
    const availableMatches = playerGroup
      ? playerGroup.matches.filter(m => 
          m.status === 'pending' && 
          (m.player1Id === loggedInPlayerId || m.player2Id === loggedInPlayerId)
        )
      : [];

    return { playerGroup, availableMatches };
  }, [bookingSlot, loggedInPlayerId, tournament.groups]);

  // Funzione wrapper per aggiornare React state e Firestore
  const handleUpdateEvents = async (updater: (prevEvents: Event[]) => Event[]) => {
    setEvents(updater);
    const updatedEvents = updater([event]);
    const updatedEvent = updatedEvents.find(e => e.id === event.id);
    if (updatedEvent) {
      await updateDoc(doc(db, "events", event.id), updatedEvent);
    }
  };

  // Prenotazione match (prima prenotazione)
  const handleBookMatch = async (timeSlot: TimeSlot) => {
    if (!bookingMatch) return;
    const matchToBookId = bookingMatch.id;
    const timeSlotId = timeSlot.id;
    await handleUpdateEvents(prevEvents => prevEvents.map(e => {
      if (e.id !== event.id) return e;
      return {
        ...e,
        tournaments: e.tournaments.map(t => {
          if (t.id !== tournament.id) return t;
          return {
            ...t,
            timeSlots: t.timeSlots.map(ts =>
              ts.id === timeSlotId ? { ...ts, matchId: matchToBookId } : ts
            ),
            groups: t.groups.map(g => ({
              ...g,
              matches: g.matches.map(m =>
                m.id === matchToBookId
                  ? { ...m, status: 'scheduled', scheduledTime: timeSlot.time, location: timeSlot.location }
                  : m
              ),
            })),
          };
        }),
      };
    }));
    setBookingMatch(null);
  };

  // Cambia slot di una partita già prenotata
  const handleRescheduleBookMatch = async (newSlot: TimeSlot) => {
    if (!rescheduleMatch) return;
    const prevSlotId = tournament.timeSlots.find(ts => ts.matchId === rescheduleMatch.id)?.id;
    await handleUpdateEvents(prevEvents => prevEvents.map(e => {
      if (e.id !== event.id) return e;
      return {
        ...e,
        tournaments: e.tournaments.map(t => {
          if (t.id !== tournament.id) return t;
          return {
            ...t,
            timeSlots: t.timeSlots.map(ts =>
              ts.id === newSlot.id
                ? { ...ts, matchId: rescheduleMatch.id }
                : ts.id === prevSlotId
                ? { ...ts, matchId: null }
                : ts
            ),
            groups: t.groups.map(g => ({
              ...g,
              matches: g.matches.map(m =>
                m.id === rescheduleMatch.id
                  ? { ...m, scheduledTime: newSlot.time, location: newSlot.location }
                  : m
              ),
            })),
          };
        }),
      };
    }));
    setRescheduleMatch(null);
  };

  // Apertura modal per prenotazione slot-first
  const handleSlotInitiatedBooking = (slot: TimeSlot) => {
    setBookingSlot(slot);
  };

  // Prenotazione slot-first con transazione Firestore atomica
  const handleBookMatchWithSlot = async (matchId: string) => {
    if (!bookingSlot) return;
    
    const slotId = bookingSlot.id;
    const slotTime = bookingSlot.time;
    const slotLocation = bookingSlot.location;

    try {
      const eventRef = doc(db, "events", event.id);
      
      await runTransaction(db, async (transaction) => {
        const eventDoc = await transaction.get(eventRef);
        
        if (!eventDoc.exists()) {
          throw new Error("Evento non trovato");
        }

        const eventData = eventDoc.data() as Event;
        const currentTournament = eventData.tournaments.find(t => t.id === tournament.id);
        
        if (!currentTournament) {
          throw new Error("Torneo non trovato");
        }

        // Verifica che lo slot sia ancora libero
        const currentSlot = currentTournament.timeSlots.find(ts => ts.id === slotId);
        if (!currentSlot || currentSlot.matchId !== null) {
          throw new Error("Lo slot è già stato prenotato da un altro utente");
        }

        // Verifica che la partita sia ancora pending
        let matchFound = false;
        let matchGroupId = '';
        for (const group of currentTournament.groups) {
          const match = group.matches.find(m => m.id === matchId);
          if (match) {
            if (match.status !== 'pending') {
              throw new Error("La partita non è più disponibile per la prenotazione");
            }
            matchFound = true;
            matchGroupId = group.id;
            break;
          }
        }

        if (!matchFound) {
          throw new Error("Partita non trovata");
        }

        // Aggiorna atomicamente slot e match
        const updatedTournaments = eventData.tournaments.map(t => {
          if (t.id !== tournament.id) return t;
          return {
            ...t,
            timeSlots: t.timeSlots.map(ts =>
              ts.id === slotId ? { ...ts, matchId } : ts
            ),
            groups: t.groups.map(g => ({
              ...g,
              matches: g.matches.map(m =>
                m.id === matchId
                  ? { ...m, status: 'scheduled' as const, scheduledTime: slotTime, location: slotLocation }
                  : m
              ),
            })),
          };
        });

        transaction.update(eventRef, { tournaments: updatedTournaments });
      });

      // Aggiorna lo stato React locale dopo il successo della transazione
      setEvents(prev => prev.map(e => {
        if (e.id !== event.id) return e;
        return {
          ...e,
          tournaments: e.tournaments.map(t => {
            if (t.id !== tournament.id) return t;
            return {
              ...t,
              timeSlots: t.timeSlots.map(ts =>
                ts.id === slotId ? { ...ts, matchId } : ts
              ),
              groups: t.groups.map(g => ({
                ...g,
                matches: g.matches.map(m =>
                  m.id === matchId
                    ? { ...m, status: 'scheduled', scheduledTime: slotTime, location: slotLocation }
                    : m
                ),
              })),
            };
          }),
        };
      }));

      setBookingSlot(null);
    } catch (error) {
      console.error('Errore durante la prenotazione:', error);
      const errorMessage = error instanceof Error ? error.message : 'Impossibile completare la prenotazione';
      setBookingSlot(null);
      // Show error in a better way - using the same pattern as successful booking
      setTimeout(() => {
        alert(`Errore: ${errorMessage}`);
      }, 100);
    }
  };

  // Modifica risultato partita
  const handleUpdateMatchResult = async (matchId: string, score1: number, score2: number) => {
    await handleUpdateEvents(prevEvents => prevEvents.map(e => {
      if (e.id !== event.id) return e;
      return {
        ...e,
        tournaments: e.tournaments.map(t => {
          if (t.id !== tournament.id) return t;
          return {
            ...t,
            groups: t.groups.map(g => ({
              ...g,
              matches: g.matches.map(m =>
                m.id === matchId ? { ...m, score1, score2, status: 'completed' } : m
              ),
            })),
          };
        }),
      };
    }));
  };

  const handleEditResult = (match: Match) => {
    setEditingMatch(match);
    setScore1(match.score1?.toString() ?? '');
    setScore2(match.score2?.toString() ?? '');
  };

  const handleSaveResult = async () => {
    if (editingMatch) {
      const s1 = parseInt(score1, 10);
      const s2 = parseInt(score2, 10);
      if (!isNaN(s1) && !isNaN(s2)) {
        await handleUpdateMatchResult(editingMatch.id, s1, s2);
        setEditingMatch(null);
      }
    }
  };

  // Aggiunta girone
  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const newGroup: Group = {
      id: `g${Date.now()}`,
      name: newGroupName.trim(),
      playerIds: [],
      matches: [],
    };
    await handleUpdateEvents(prevEvents =>
      prevEvents.map(e =>
        e.id === event.id
          ? {
              ...e,
              tournaments: e.tournaments.map(t =>
                t.id === tournament.id
                  ? { ...t, groups: [...t.groups, newGroup] }
                  : t
              ),
            }
          : e
      )
    );
    setNewGroupName('');
    setIsAddGroupModalOpen(false);
    if (!selectedGroupId) setSelectedGroupId(newGroup.id);
  };

  const availableTimeSlots = tournament.timeSlots.filter(ts => ts.matchId === null);

  const TABS: { id: Tab; name: string; isVisible: () => boolean }[] = [
    { id: 'standings', name: 'Classifica', isVisible: () => true },
    { id: 'matches', name: 'Partite', isVisible: () => true },
    { id: 'players', name: 'Giocatori', isVisible: () => true },
    { id: 'timeSlots', name: 'Slot Orari', isVisible: () => true },
    { id: 'playoffs', name: 'Playoff', isVisible: () => isOrganizer || (tournament.playoffs?.isGenerated ?? false) },
    { id: 'consolation', name: 'Consolazione', isVisible: () => isOrganizer || (tournament.consolationBracket?.isGenerated ?? false) },
    { id: 'groupManagement', name: 'Gestione Gironi', isVisible: () => isOrganizer },
    { id: 'settings', name: 'Impostazioni', isVisible: () => isOrganizer }, // <-- tab impostazioni visibile per organizer!
    { id: 'chat', name: 'Chat', isVisible: () => true },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-secondary p-4 rounded-xl shadow-lg flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">{tournament.name}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Girone:</span>
          {tournament.groups.length > 0 ? (
            <select
              value={selectedGroupId}
              onChange={e => setSelectedGroupId(e.target.value)}
              className="bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-accent"
            >
              {tournament.groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-text-secondary italic">Nessun girone</span>
          )}
          {isOrganizer && (
            <button
              onClick={() => setIsAddGroupModalOpen(true)}
              className="ml-2 bg-highlight/80 hover:bg-highlight p-2 rounded-full text-white transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-tertiary/50 flex-wrap">
        {TABS.map(({ id, name, isVisible }) => {
          if (!isVisible()) return null;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 font-semibold transition-colors capitalize border-b-2 ${
                activeTab === id
                  ? 'border-accent text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div className="animate-fadeIn">
        {activeTab === 'standings' &&
          (selectedGroup ? (
            <StandingsTable
              group={selectedGroup}
              players={event.players}
              settings={tournament.settings}
              loggedInPlayerId={loggedInPlayerId}
              onPlayerContact={onPlayerContact}
            />
          ) : (
            <p className="text-center text-text-secondary">Nessun girone a cui partecipare.</p>
          ))}
        {activeTab === 'matches' &&
          (selectedGroup ? (
            <MatchList
              group={selectedGroup}
              players={event.players}
              onEditResult={handleEditResult}
              onBookMatch={setBookingMatch}
              isOrganizer={isOrganizer}
              loggedInPlayerId={loggedInPlayerId}
              onPlayerContact={onPlayerContact}
              onRescheduleMatch={setRescheduleMatch}
            />
          ) : (
            <p className="text-center text-text-secondary">Nessun girone a cui partecipare.</p>
          ))}
        {activeTab === 'players' && (
          <PlayerManagement
            event={event}
            setEvents={setEvents}
            isOrganizer={isOrganizer}
            onPlayerContact={onPlayerContact}
          />
        )}
        {activeTab === 'timeSlots' && (
          <TimeSlots 
            event={event} 
            tournament={tournament} 
            setEvents={setEvents} 
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
            selectedGroupId={selectedGroupId}
            onSlotBook={handleSlotInitiatedBooking}
          />
        )}
        {activeTab === 'chat' && <ChatPanel />}
        {activeTab === 'groupManagement' && isOrganizer && (
          <GroupManagement event={event} tournament={tournament} setEvents={setEvents} />
        )}
        {activeTab === 'settings' && isOrganizer && (
          <TournamentSettings event={event} tournament={tournament} setEvents={setEvents} />
        )}
        {activeTab === 'playoffs' && (
          <Playoffs
            event={event}
            tournament={tournament}
            setEvents={setEvents}
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
          />
        )}
        {activeTab === 'consolation' && (
          <ConsolationBracket
            event={event}
            tournament={tournament}
            setEvents={setEvents}
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
          />
        )}
      </div>

      {editingMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-sm border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Inserisci/Modifica Risultato</h4>
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold">
                {event.players.find(p => p.id === editingMatch.player1Id)?.name}
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={score1}
                  onChange={e => setScore1(e.target.value)}
                  className="w-16 text-center bg-primary p-2 rounded-lg"
                />
                <span>-</span>
                <input
                  type="number"
                  value={score2}
                  onChange={e => setScore2(e.target.value)}
                  className="w-16 text-center bg-primary p-2 rounded-lg"
                />
              </div>
              <span className="font-semibold">
                {event.players.find(p => p.id === editingMatch.player2Id)?.name}
              </span>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={() => setEditingMatch(null)}
                className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveResult}
                className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {bookingMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Prenota Partita</h4>
            <p className="mb-4 text-text-secondary">
              Seleziona uno slot orario disponibile per la partita: <br />
              <strong className="text-text-primary">
                {event.players.find(p => p.id === bookingMatch.player1Id)?.name} vs{' '}
                {event.players.find(p => p.id === bookingMatch.player2Id)?.name}
              </strong>
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {availableTimeSlots.length > 0 ? (
                availableTimeSlots.map(ts => (
                  <button
                    key={ts.id}
                    onClick={() => handleBookMatch(ts)}
                    className="w-full text-left bg-tertiary hover:bg-highlight p-3 rounded-lg transition-colors"
                  >
                    <p>
                      {new Date(ts.time).toLocaleString('it-IT', {
                        dateStyle: 'full',
                        timeStyle: 'short',
                      })}
                    </p>
                    <p className="text-sm text-text-secondary">{ts.location}</p>
                  </button>
                ))
              ) : (
                <p className="text-text-secondary text-center p-4">
                  Nessuno slot orario disponibile. Chiedi all'organizzatore di aggiungerne.
                </p>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setBookingMatch(null)}
                className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Cambia slot partita</h4>
            <p className="mb-4 text-text-secondary">
              Scegli uno slot diverso per{' '}
              <strong className="text-text-primary">
                {event.players.find(p => p.id === rescheduleMatch.player1Id)?.name} vs{' '}
                {event.players.find(p => p.id === rescheduleMatch.player2Id)?.name}
              </strong>
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {tournament.timeSlots
                .filter(ts => !ts.matchId || ts.matchId === rescheduleMatch.id)
                .map(ts => (
                  <button
                    key={ts.id}
                    onClick={() => handleRescheduleBookMatch(ts)}
                    className="w-full text-left bg-tertiary hover:bg-highlight p-3 rounded-lg transition-colors"
                  >
                    <p>
                      {new Date(ts.time).toLocaleString('it-IT', {
                        dateStyle: 'full',
                        timeStyle: 'short',
                      })}
                    </p>
                    <p className="text-sm text-text-secondary">{ts.location}</p>
                  </button>
                ))}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setRescheduleMatch(null)}
                className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddGroupModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-sm border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Aggiungi Nuovo Girone</h4>
            <form onSubmit={handleAddGroup}>
              <input
                type="text"
                placeholder="Nome del girone"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
                autoFocus
              />
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddGroupModalOpen(false)}
                  className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Crea Girone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bookingSlot && slotBookingData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Prenota Partita per lo Slot</h4>
            <div className="bg-primary/50 p-3 rounded-lg mb-4">
              <p className="text-sm text-text-secondary mb-1">Slot selezionato:</p>
              <p className="font-semibold">
                {new Date(bookingSlot.time).toLocaleString('it-IT', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </p>
              <p className="text-sm text-accent">{bookingSlot.location}</p>
            </div>

            {!slotBookingData.playerGroup ? (
              <p className="text-text-secondary text-center py-4">
                Non sei iscritto a nessun girone.
              </p>
            ) : slotBookingData.availableMatches.length === 0 ? (
              <p className="text-text-secondary text-center py-4">
                Non hai partite in attesa di prenotazione nel girone "{slotBookingData.playerGroup.name}".
              </p>
            ) : (
              <>
                <p className="mb-3 text-text-secondary text-sm">
                  Seleziona una delle tue partite in attesa:
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {slotBookingData.availableMatches.map(match => {
                    const player1 = event.players.find(p => p.id === match.player1Id);
                    const player2 = event.players.find(p => p.id === match.player2Id);
                    return (
                      <button
                        key={match.id}
                        onClick={() => handleBookMatchWithSlot(match.id)}
                        className="w-full text-left bg-tertiary hover:bg-highlight p-3 rounded-lg transition-colors"
                      >
                        <p className="font-semibold">
                          {player1?.name || '?'} vs {player2?.name || '?'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setBookingSlot(null)}
                className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentView;