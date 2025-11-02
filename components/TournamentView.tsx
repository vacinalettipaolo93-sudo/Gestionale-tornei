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
// NAV ordering: Classifica - Partite - Giocatori - Slot Orari - Playoff - Consolation - Gestione Gironi - Impostazioni - Chat
// Playoff/Consolation: sempre visibili in admin (nota se non generati), lato utente solo se generati.

const TournamentView: React.FC<{
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (p: Player) => void;
}> = ({ event, tournament, setEvents, isOrganizer, loggedInPlayerId, onPlayerContact }) => {
  const [activeTab, setActiveTab] = useState<'standings'|'matches'|'players'|'timeSlots'|'playoffs'|'consolation'|'groupManagement'|'settings'|'chat'>('standings');

  // selezione girone e modalità di visualizzazione
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(tournament.groups.length > 0 ? tournament.groups[0].id : null);
  const [viewingOtherGroups, setViewingOtherGroups] = useState(false);

  // booking / reschedule / edit result
  const [bookingMatch, setBookingMatch] = useState<Match | null>(null);
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null);
  const [rescheduleMatch, setRescheduleMatch] = useState<Match | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const userGroupId = loggedInPlayerId ? tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId))?.id : undefined;

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

  // Safe date formatter to avoid "Invalid option: timeStyle" in some environments
  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    try {
      return d.toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' });
    } catch (e) {
      return `${d.toLocaleDateString('it-IT')} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  // Remove undefined recursively before sending payload to Firestore
  const cleanForFirestore = (obj: any): any => {
    if (obj === undefined) return undefined;
    if (obj === null) return null;
    if (Array.isArray(obj)) {
      const arr = obj.map(cleanForFirestore).filter(item => item !== undefined);
      return arr;
    }
    if (typeof obj === 'object') {
      const out: any = {};
      Object.keys(obj).forEach(k => {
        const v = cleanForFirestore(obj[k]);
        if (v !== undefined) out[k] = v;
      });
      return out;
    }
    return obj;
  };

  // wrapper per aggiornare UI + Firestore (pulisce undefined)
  const handleUpdateEvents = async (updater: (prevEvents: Event[]) => Event[]) => {
    setEvents(updater);
    const updatedEvents = updater([event]);
    const updatedEvent = updatedEvents.find(e => e.id === event.id);
    if (updatedEvent) {
      const deep = JSON.parse(JSON.stringify(updatedEvent));
      const payload = cleanForFirestore(deep);
      await updateDoc(doc(db, "events", event.id), payload);
    }
  };

  // ---------- Booking / reschedule / cancel / result handlers (unchanged logic, with safer local updates) ----------
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

  const handleSlotInitiatedBooking = (slot: TimeSlot) => {
    setBookingSlot(slot);
    setBookingError(null);
  };

  const handleBookMatchWithSlot = async (matchToBook: Match) => {
    if (!bookingSlot) return;
    setBookingLoading(true);
    setBookingError(null);
    const docRef = doc(db, "events", event.id);

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Evento non trovato");

        const currentEvent = docSnap.data() as Event;
        const tIndex = currentEvent.tournaments.findIndex(t => t.id === tournament.id);
        if (tIndex === -1) throw new Error("Torneo non trovato");

        const tSnapshot = currentEvent.tournaments[tIndex];

        const slotIndex = tSnapshot.timeSlots.findIndex(ts => ts.id === bookingSlot.id);
        if (slotIndex === -1) throw new Error("Slot non trovato");
        if (tSnapshot.timeSlots[slotIndex].matchId) throw new Error("Slot già prenotato");

        const groupIndex = tSnapshot.groups.findIndex(g =>
          (selectedGroupId && g.id === selectedGroupId) || (loggedInPlayerId ? g.playerIds.includes(loggedInPlayerId) : false)
        );
        if (groupIndex === -1) throw new Error("Girone del giocatore non trovato");

        const matchIndex = tSnapshot.groups[groupIndex].matches.findIndex(m => m.id === matchToBook.id);
        if (matchIndex === -1) throw new Error("Partita non trovata nel girone");
        if (tSnapshot.groups[groupIndex].matches[matchIndex].status !== 'pending') throw new Error("La partita non è più disponibile");

        const updatedEvent = JSON.parse(JSON.stringify(currentEvent)) as Event;
        const tObj = updatedEvent.tournaments.find(tt => tt.id === tournament.id)!;
        const slotToUpdate = tObj.timeSlots.find(ts => ts.id === bookingSlot.id)!;
        slotToUpdate.matchId = matchToBook.id;

        const groupObj = tObj.groups[groupIndex];
        const matchObj = groupObj.matches.find(m => m.id === matchToBook.id)!;
        matchObj.status = 'scheduled';
        matchObj.scheduledTime = slotToUpdate.time;
        matchObj.location = slotToUpdate.location;

        transaction.update(docRef, updatedEvent);
      });

      await handleUpdateEvents(prevEvents => prevEvents.map(e => {
        if (e.id !== event.id) return e;
        return {
          ...e,
          tournaments: e.tournaments.map(t => {
            if (t.id !== tournament.id) return t;
            return {
              ...t,
              timeSlots: t.timeSlots.map(ts =>
                ts.id === bookingSlot.id ? { ...ts, matchId: matchToBook.id } : ts
              ),
              groups: t.groups.map(g => ({
                ...g,
                matches: g.matches.map(m =>
                  m.id === matchToBook.id
                    ? { ...m, status: 'scheduled', scheduledTime: bookingSlot.time, location: bookingSlot.location }
                    : m
                ),
              })),
            };
          }),
        };
      }));

      setBookingSlot(null);
    } catch (err: any) {
      console.error("Errore prenotazione slot:", err);
      setBookingError(err?.message || 'Errore durante la prenotazione');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleRescheduleBookMatch = async (newSlot: TimeSlot) => {
    // Defensive checks
    if (!rescheduleMatch) {
      console.warn('handleRescheduleBookMatch called but rescheduleMatch is null');
      return;
    }
    if (!newSlot) {
      console.warn('handleRescheduleBookMatch called with undefined newSlot');
      return;
    }

    setBookingLoading(true);
    setBookingError(null);
    const docRef = doc(db, "events", event.id);

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Evento non trovato");

        const currentEvent = docSnap.data() as Event;
        const tIndex = currentEvent.tournaments.findIndex(t => t.id === tournament.id);
        if (tIndex === -1) throw new Error("Torneo non trovato");

        const tSnapshot = currentEvent.tournaments[tIndex];

        const prevSlotIndex = tSnapshot.timeSlots.findIndex(ts => ts.matchId === rescheduleMatch.id);
        const newSlotIndex = tSnapshot.timeSlots.findIndex(ts => ts.id === newSlot.id);
        if (newSlotIndex === -1) throw new Error("Slot nuovo non trovato");

        const newSlotMatchId = tSnapshot.timeSlots[newSlotIndex].matchId;
        if (newSlotMatchId && newSlotMatchId !== rescheduleMatch.id) throw new Error("Il nuovo slot è già occupato");

        const updatedEvent = JSON.parse(JSON.stringify(currentEvent)) as Event;
        const tObj = updatedEvent.tournaments.find(tt => tt.id === tournament.id)!;

        if (prevSlotIndex !== -1) {
          const prevSlotId = tSnapshot.timeSlots[prevSlotIndex].id;
          const prevSlotObj = tObj.timeSlots.find(ts => ts.id === prevSlotId);
          if (prevSlotObj) prevSlotObj.matchId = null;
        }

        const newSlotObj = tObj.timeSlots.find(ts => ts.id === newSlot.id)!;
        newSlotObj.matchId = rescheduleMatch.id;

        const groupIndex = tObj.groups.findIndex(g => g.matches.some(m => m.id === rescheduleMatch.id));
        if (groupIndex === -1) throw new Error("Girone della partita non trovato");
        const matchObj = tObj.groups[groupIndex].matches.find(m => m.id === rescheduleMatch.id)!;
        matchObj.scheduledTime = newSlotObj.time;
        matchObj.location = newSlotObj.location;
        matchObj.status = 'scheduled';

        transaction.update(docRef, updatedEvent);
      });

      // Local update: remove previous slot refs and set new one (avoid undefined)
      await handleUpdateEvents(prevEvents => prevEvents.map(e => {
        if (e.id !== event.id) return e;
        return {
          ...e,
          tournaments: e.tournaments.map(t => {
            if (t.id !== tournament.id) return t;
            const prevSlotId = t.timeSlots.find(ts => ts.matchId === rescheduleMatch.id)?.id;
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
                matches: g.matches.map(m => {
                  if (m.id === rescheduleMatch.id) {
                    const copy: any = { ...m };
                    copy.scheduledTime = newSlot.time;
                    copy.location = newSlot.location;
                    copy.status = 'scheduled';
                    // ensure no undefined properties remain
                    if ((copy as any).score1 === undefined) delete (copy as any).score1;
                    if ((copy as any).score2 === undefined) delete (copy as any).score2;
                    return copy;
                  }
                  return m;
                }),
              })),
            };
          }),
        };
      }));

      setRescheduleMatch(null);
    } catch (err: any) {
      console.error("Errore reschedule:", err);
      setBookingError(err?.message || 'Errore durante lo spostamento della partita');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async (matchToCancel: Match) => {
    setBookingLoading(true);
    setBookingError(null);
    const docRef = doc(db, "events", event.id);

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Evento non trovato");

        const currentEvent = docSnap.data() as Event;
        const tIndex = currentEvent.tournaments.findIndex(t => t.id === tournament.id);
        if (tIndex === -1) throw new Error("Torneo non trovato");

        const tSnapshot = currentEvent.tournaments[tIndex];

        const slotIndex = tSnapshot.timeSlots.findIndex(ts => ts.matchId === matchToCancel.id);
        if (slotIndex === -1) throw new Error("Slot associato alla partita non trovato");

        const updatedEvent = JSON.parse(JSON.stringify(currentEvent)) as Event;
        const tObj = updatedEvent.tournaments.find(tt => tt.id === tournament.id)!;
        const slotObj = tObj.timeSlots.find(ts => ts.id === tSnapshot.timeSlots[slotIndex].id)!;
        slotObj.matchId = null;

        const groupIndex = tObj.groups.findIndex(g => g.matches.some(m => m.id === matchToCancel.id));
        if (groupIndex === -1) throw new Error("Girone della partita non trovato");
        const matchObj = tObj.groups[groupIndex].matches.find(m => m.id === matchToCancel.id)!;
        matchObj.status = 'pending';
        // delete fields in transaction-level copy
        delete (matchObj as any).scheduledTime;
        delete (matchObj as any).location;

        transaction.update(docRef, updatedEvent);
      });

      // aggiorna stato locale - delete properties instead of setting undefined
      await handleUpdateEvents(prevEvents => prevEvents.map(e => {
        if (e.id !== event.id) return e;
        return {
          ...e,
          tournaments: e.tournaments.map(t => {
            if (t.id !== tournament.id) return t;
            return {
              ...t,
              timeSlots: t.timeSlots.map(ts =>
                ts.matchId === matchToCancel.id ? { ...ts, matchId: null } : ts
              ),
              groups: t.groups.map(g => ({
                ...g,
                matches: g.matches.map(m => {
                  if (m.id === matchToCancel.id) {
                    const copy: any = { ...m };
                    // remove fields rather than setting to undefined
                    if ('score1' in copy && copy.score1 === undefined) delete copy.score1;
                    if ('score2' in copy && copy.score2 === undefined) delete copy.score2;
                    if ('scheduledTime' in copy) delete copy.scheduledTime;
                    if ('location' in copy) delete copy.location;
                    copy.status = 'pending';
                    return copy;
                  }
                  return m;
                }),
              })),
            };
          }),
        };
      }));
    } catch (err: any) {
      console.error("Errore annullamento prenotazione:", err);
      setBookingError(err?.message || 'Errore durante l\'annullamento della prenotazione');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleDeleteResult = async (matchToDelete: Match) => {
    setBookingLoading(true);
    setBookingError(null);
    const docRef = doc(db, "events", event.id);

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Evento non trovato");

        const currentEvent = docSnap.data() as Event;
        const tIndex = currentEvent.tournaments.findIndex(t => t.id === tournament.id);
        if (tIndex === -1) throw new Error("Torneo non trovato");
        const tSnapshot = currentEvent.tournaments[tIndex];

        const groupIndex = tSnapshot.groups.findIndex(g => g.matches.some(m => m.id === matchToDelete.id));
        if (groupIndex === -1) throw new Error("Girone della partita non trovato");
        const matchIndex = tSnapshot.groups[groupIndex].matches.findIndex(m => m.id === matchToDelete.id);
        if (matchIndex === -1) throw new Error("Partita non trovata");

        const updatedEvent = JSON.parse(JSON.stringify(currentEvent)) as Event;
        const tObj = updatedEvent.tournaments.find(tt => tt.id === tournament.id)!;
        const groupObj = tObj.groups[groupIndex];
        const matchObj = groupObj.matches.find(m => m.id === matchToDelete.id)!;

        if (matchObj.scheduledTime) matchObj.status = 'scheduled';
        else matchObj.status = 'pending';
        delete (matchObj as any).score1;
        delete (matchObj as any).score2;

        transaction.update(docRef, updatedEvent);
      });

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
                matches: g.matches.map(m => {
                  if (m.id === matchToDelete.id) {
                    const copy: any = { ...m };
                    if (copy.scheduledTime === undefined) delete copy.scheduledTime;
                    if (copy.location === undefined) delete copy.location;
                    if (copy.score1 === undefined) delete copy.score1;
                    if (copy.score2 === undefined) delete copy.score2;
                    copy.status = (copy.scheduledTime ? 'scheduled' : 'pending');
                    return copy;
                  }
                  return m;
                }),
              })),
            };
          }),
        };
      }));
    } catch (err: any) {
      console.error("Errore cancellazione risultato:", err);
      setBookingError(err?.message || 'Errore durante la cancellazione del risultato');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleUpdateMatchResult = async (matchId: string, s1: number, s2: number) => {
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
                m.id === matchId ? { ...m, score1: s1, score2: s2, status: 'completed' } : m
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

  const getPlayer = (playerId?: string) => event.players.find(p => p.id === playerId);

  const tournamentForPlayoffs = isOrganizer && !tournament.playoffs ? { ...tournament, playoffs: { isGenerated: false, matches: [], finalId: null, bronzeFinalId: null } as any } : tournament;
  const tournamentForConsolation = isOrganizer && !tournament.consolationBracket ? { ...tournament, consolationBracket: { isGenerated: false, matches: [], finalId: null, bronzeFinalId: null } as any } : tournament;

  return (
    <div>
      {/* NAV in requested order with improved styling */}
      <div className="mb-6">
        <nav role="tablist" aria-label="Tournament navigation" className="flex flex-wrap gap-3 items-center">
          {/* tab button shared style */}
          {/** Helper function inline for classes is replaced with template strings below **/}

          <button
            onClick={() => setActiveTab('standings')}
            aria-current={activeTab === 'standings' ? 'page' : undefined}
            className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'standings' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
          >
            Classifica
          </button>

          <button
            onClick={() => setActiveTab('matches')}
            aria-current={activeTab === 'matches' ? 'page' : undefined}
            className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'matches' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
          >
            Partite
          </button>

          <button
            onClick={() => setActiveTab('players')}
            aria-current={activeTab === 'players' ? 'page' : undefined}
            className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'players' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
          >
            Giocatori
          </button>

          <button
            onClick={() => setActiveTab('timeSlots')}
            aria-current={activeTab === 'timeSlots' ? 'page' : undefined}
            className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'timeSlots' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
          >
            Slot Orari
          </button>

          {/* Playoffs / Consolation: admin always sees (with note), users only if generated */}
          {isOrganizer ? (
            <>
              <button
                onClick={() => setActiveTab('playoffs')}
                aria-current={activeTab === 'playoffs' ? 'page' : undefined}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'playoffs' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
              >
                Playoffs{!tournament.playoffs ? ' (non generato)' : ''}
              </button>

              <button
                onClick={() => setActiveTab('consolation')}
                aria-current={activeTab === 'consolation' ? 'page' : undefined}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'consolation' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
              >
                Consolation{!tournament.consolationBracket ? ' (non generato)' : ''}
              </button>
            </>
          ) : (
            <>
              {tournament.playoffs && (
                <button
                  onClick={() => setActiveTab('playoffs')}
                  aria-current={activeTab === 'playoffs' ? 'page' : undefined}
                  className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'playoffs' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
                >
                  Playoffs
                </button>
              )}
              {tournament.consolationBracket && (
                <button
                  onClick={() => setActiveTab('consolation')}
                  aria-current={activeTab === 'consolation' ? 'page' : undefined}
                  className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'consolation' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
                >
                  Consolation
                </button>
              )}
            </>
          )}

          {/* Admin-only controls */}
          {isOrganizer && (
            <>
              <button
                onClick={() => setActiveTab('groupManagement')}
                aria-current={activeTab === 'groupManagement' ? 'page' : undefined}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'groupManagement' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
              >
                Gestione Gironi
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                aria-current={activeTab === 'settings' ? 'page' : undefined}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'settings' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
              >
                Impostazioni
              </button>
            </>
          )}

          {/* Chat always last */}
          <button
            onClick={() => setActiveTab('chat')}
            aria-current={activeTab === 'chat' ? 'page' : undefined}
            className={`px-4 py-2 rounded-full transition-all duration-200 ${activeTab === 'chat' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
          >
            Chat
          </button>
        </nav>
      </div>

      {/* Toggle for users */}
      {!isOrganizer && loggedInPlayerId && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm text-text-secondary">Visualizza altri gironi?</label>
          <button onClick={() => setViewingOtherGroups(prev => !prev)} className="bg-tertiary/80 hover:bg-tertiary text-text-primary py-1 px-3 rounded">
            {viewingOtherGroups ? 'Disattiva (torna al tuo girone)' : 'Mostra altri gironi (solo risultati)'}
          </button>

          {viewingOtherGroups && (
            <select value={selectedGroupId ?? ''} onChange={e => setSelectedGroupId(e.target.value || null)} className="ml-2 bg-primary border rounded p-1">
              <option value="">-- Scegli girone --</option>
              {tournament.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Organizer select */}
      {isOrganizer && (
        <div className="mb-4">
          <label className="text-sm text-text-secondary mr-2">Seleziona girone:</label>
          <select value={selectedGroupId ?? ''} onChange={e => setSelectedGroupId(e.target.value || null)} className="bg-primary border rounded p-1">
            {tournament.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}

      <div className="animate-fadeIn">
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

        {activeTab === 'players' && (
          isOrganizer ? (
            <PlayerManagement event={event} setEvents={setEvents} isOrganizer={isOrganizer} onPlayerContact={onPlayerContact} />
          ) : (
            <PlayerManagement event={event} setEvents={setEvents} isOrganizer={isOrganizer} onPlayerContact={onPlayerContact} />
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

        {activeTab === 'playoffs' && (isOrganizer || tournament.playoffs) && (
          <Playoffs
            event={event}
            tournament={tournamentForPlayoffs}
            setEvents={setEvents}
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
          />
        )}

        {activeTab === 'consolation' && (isOrganizer || tournament.consolationBracket) && (
          <ConsolationBracket
            event={event}
            tournament={tournamentForConsolation}
            setEvents={setEvents}
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
          />
        )}

        {activeTab === 'groupManagement' && isOrganizer && <GroupManagement event={event} tournament={tournament} setEvents={setEvents} />}
        {activeTab === 'settings' && isOrganizer && <TournamentSettings event={event} tournament={tournament} setEvents={setEvents} />}
        {activeTab === 'chat' && <ChatPanel />}
      </div>

      {/* Modals (unchanged) */}
      {bookingMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Prenota Partita</h4>
            <p className="mb-4 text-text-secondary">Seleziona uno slot orario disponibile per la partita: <br />
              <strong className="text-text-primary">{getPlayer(bookingMatch.player1Id)?.name} vs {getPlayer(bookingMatch.player2Id)?.name}</strong>
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {tournament.timeSlots.filter(ts => !ts.matchId).map(ts => (
                <button key={ts.id} onClick={() => handleBookMatch(ts)} className="w-full text-left bg-tertiary hover:bg-highlight p-3 rounded-lg">
                  <p>{formatDateTime(ts.time)}</p>
                  <p className="text-sm text-text-secondary">{ts.location}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setBookingMatch(null)} className="bg-tertiary py-2 px-4 rounded-lg">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {rescheduleMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Cambia slot partita</h4>
            <p className="mb-4 text-text-secondary">Scegli uno slot diverso per <strong className="text-text-primary">{getPlayer(rescheduleMatch.player1Id)?.name} vs {getPlayer(rescheduleMatch.player2Id)?.name}</strong></p>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {tournament.timeSlots.filter(ts => !ts.matchId || ts.matchId === rescheduleMatch.id).map(ts => (
                <button key={ts.id} onClick={() => handleRescheduleBookMatch(ts)} className="w-full text-left bg-tertiary hover:bg-highlight p-3 rounded-lg">
                  <p>{formatDateTime(ts.time)}</p>
                  <p className="text-sm text-text-secondary">{ts.location}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setRescheduleMatch(null)} className="bg-tertiary py-2 px-4 rounded-lg">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {bookingSlot && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Assegna partita allo slot</h4>
            <p className="mb-4 text-text-secondary">Hai scelto lo slot: <strong className="text-text-primary">{formatDateTime(bookingSlot.time)} — {bookingSlot.location}</strong></p>
            {(() => {
              const playerGroup = selectedGroup ?? tournament.groups.find(g => loggedInPlayerId ? g.playerIds.includes(loggedInPlayerId) : false);
              if (!loggedInPlayerId || !playerGroup) return <p className="text-text-secondary">Non sei iscritto a nessun girone in questo torneo.</p>;
              const pendingMatches = playerGroup.matches.filter(m => m.status === 'pending');
              if (pendingMatches.length === 0) return <p className="text-text-secondary">Nessuna partita pending nel tuo girone da assegnare a questo slot.</p>;
              return (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {pendingMatches.map(pm => (
                    <button key={pm.id} onClick={() => handleBookMatchWithSlot(pm)} disabled={bookingLoading} className="w-full text-left bg-tertiary hover:bg-highlight p-3 rounded-lg">
                      <p>{getPlayer(pm.player1Id)?.name} vs {getPlayer(pm.player2Id)?.name}</p>
                    </button>
                  ))}
                </div>
              );
            })()}
            {bookingError && <div className="text-red-400 mt-3">{bookingError}</div>}
            <div className="flex justify-end mt-6">
              <button onClick={() => setBookingSlot(null)} className="bg-tertiary py-2 px-4 rounded-lg">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Modern, simple result banner/modal: player1 - big black score - player2 */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-secondary rounded-xl shadow-2xl p-4 w-full max-w-lg border border-tertiary">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-text-secondary">Inserisci risultato</div>
                <div className="font-semibold text-lg">{getPlayer(editingMatch.player1Id)?.name} <span className="text-sm text-text-secondary">vs</span> {getPlayer(editingMatch.player2Id)?.name}</div>
              </div>
              <button onClick={() => setEditingMatch(null)} className="text-text-secondary hover:text-red-500">Chiudi ✕</button>
            </div>

            <div className="flex items-center justify-center gap-6 py-3">
              {/* Player 1 */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-sm text-text-secondary">Player 1</div>
                <input
                  autoFocus
                  value={score1}
                  onChange={e => setScore1(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveResult(); }}
                  className="w-28 text-center text-black font-extrabold text-4xl border rounded p-2"
                  inputMode="numeric"
                  aria-label="Punteggio giocatore 1"
                />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { const n = parseInt(score1 || '0', 10) || 0; setScore1(String(Math.max(0, n-1))); }} className="px-3 py-1 rounded bg-tertiary">−</button>
                  <button onClick={() => { const n = parseInt(score1 || '0', 10) || 0; setScore1(String(n+1)); }} className="px-3 py-1 rounded bg-tertiary">+</button>
                </div>
              </div>

              <div className="text-2xl font-bold text-text-secondary">:</div>

              {/* Player 2 */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-sm text-text-secondary">Player 2</div>
                <input
                  value={score2}
                  onChange={e => setScore2(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveResult(); }}
                  className="w-28 text-center text-black font-extrabold text-4xl border rounded p-2"
                  inputMode="numeric"
                  aria-label="Punteggio giocatore 2"
                />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { const n = parseInt(score2 || '0', 10) || 0; setScore2(String(Math.max(0, n-1))); }} className="px-3 py-1 rounded bg-tertiary">−</button>
                  <button onClick={() => { const n = parseInt(score2 || '0', 10) || 0; setScore2(String(n+1)); }} className="px-3 py-1 rounded bg-tertiary">+</button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setEditingMatch(null)} className="bg-tertiary px-4 py-2 rounded">Annulla</button>
              <button onClick={handleSaveResult} className="bg-highlight px-4 py-2 rounded text-white font-bold">Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentView;
