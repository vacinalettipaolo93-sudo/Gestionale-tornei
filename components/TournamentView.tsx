import React, { useState } from 'react';
import { type Event, type Tournament, type Match, type TimeSlot, type Player } from '../types';
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

// TournamentView: mantiene il comportamento originale e aggiunge:
// - prenotazione "slot-first" (bookingSlot + runTransaction)
// - reschedule (spostamento) da match o da slot (runTransaction)
// - annullamento prenotazione (runTransaction)
// - cancellazione / modifica risultato (runTransaction per cancellazione, updateDoc per modifica esistente)

const TournamentView: React.FC<{
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (p: Player) => void;
}> = ({ event, tournament, setEvents, isOrganizer, loggedInPlayerId, onPlayerContact }) => {
  const [activeTab, setActiveTab] = useState<'standings'|'matches'|'players'|'timeSlots'|'chat'|'groupManagement'|'settings'|'playoffs'|'consolation'>('standings');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(tournament.groups.length > 0 ? tournament.groups[0].id : null);

  const [bookingMatch, setBookingMatch] = useState<Match | null>(null);
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null);
  const [rescheduleMatch, setRescheduleMatch] = useState<Match | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const selectedGroup = selectedGroupId ? tournament.groups.find(g => g.id === selectedGroupId) ?? null : null;

  // wrapper esistente per aggiornare React state e Firestore
  const handleUpdateEvents = async (updater: (prevEvents: Event[]) => Event[]) => {
    setEvents(updater);
    const updatedEvents = updater([event]);
    const updatedEvent = updatedEvents.find(e => e.id === event.id);
    if (updatedEvent) {
      await updateDoc(doc(db, "events", event.id), updatedEvent);
    }
  };

  // Flow originario: prenota partita scegliendo lo slot
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

  // --- SLOT-FIRST: utente ha cliccato "Prenota" su uno slot, ora sceglie la sua partita del girone ---
  const handleSlotInitiatedBooking = (slot: TimeSlot) => {
    setBookingSlot(slot);
    setBookingMatch(null);
    setBookingError(null);
  };

  // Prenota con transazione (slot-first) per garantire atomicità
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

        // verifica slot ancora libero
        const slotIndex = tSnapshot.timeSlots.findIndex(ts => ts.id === bookingSlot.id);
        if (slotIndex === -1) throw new Error("Slot non trovato");
        if (tSnapshot.timeSlots[slotIndex].matchId) throw new Error("Slot già prenotato");

        // trova girone del giocatore oppure usa selectedGroupId
        const groupIndex = tSnapshot.groups.findIndex(g =>
          (selectedGroupId && g.id === selectedGroupId) || (loggedInPlayerId ? g.playerIds.includes(loggedInPlayerId) : false)
        );
        if (groupIndex === -1) throw new Error("Girone del giocatore non trovato");

        const matchIndex = tSnapshot.groups[groupIndex].matches.findIndex(m => m.id === matchToBook.id);
        if (matchIndex === -1) throw new Error("Partita non trovata nel girone");
        if (tSnapshot.groups[groupIndex].matches[matchIndex].status !== 'pending') throw new Error("La partita non è più disponibile");

        // applica modifiche in copia profonda
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

      // aggiorna stato locale
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

  // --- RESCHEDULE: spostare partita già prenotata in un altro slot ---
  const handleRescheduleBookMatch = async (newSlot: TimeSlot) => {
    if (!rescheduleMatch) return;
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

      // aggiorna stato locale
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
                matches: g.matches.map(m =>
                  m.id === rescheduleMatch.id
                    ? { ...m, scheduledTime: newSlot.time, location: newSlot.location, status: 'scheduled' }
                    : m
                ),
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
        delete (matchObj as any).scheduledTime;
        delete (matchObj as any).location;

        transaction.update(docRef, updatedEvent);
      });

      // aggiorna stato locale
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
                matches: g.matches.map(m =>
                  m.id === matchToCancel.id
                    ? { ...m, status: 'pending', scheduledTime: undefined, location: undefined }
                    : m
                ),
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
                matches: g.matches.map(m =>
                  m.id === matchToDelete.id
                    ? { ...m, status: (m.scheduledTime ? 'scheduled' : 'pending'), score1: undefined, score2: undefined }
                    : m
                ),
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

  const getPlayer = (playerId?: string) => event.players.find(p => p.id === playerId);

  const tournamentForPlayoffs = isOrganizer && !tournament.playoffs ? { ...tournament, playoffs: { isGenerated: false, matches: [], finalId: null, bronzeFinalId: null } as any } : tournament;
  const tournamentForConsolation = isOrganizer && !tournament.consolationBracket ? { ...tournament, consolationBracket: { isGenerated: false, matches: [], finalId: null, bronzeFinalId: null } as any } : tournament;

  return (
    <div>
      {/* NAV */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('standings')} className={activeTab === 'standings' ? 'font-bold' : ''}>Classifica</button>
        <button onClick={() => setActiveTab('matches')} className={activeTab === 'matches' ? 'font-bold' : ''}>Partite</button>
        <button onClick={() => setActiveTab('players')} className={activeTab === 'players' ? 'font-bold' : ''}>Giocatori</button>
        <button onClick={() => setActiveTab('timeSlots')} className={activeTab === 'timeSlots' ? 'font-bold' : ''}>Slot Orari</button>
        {isOrganizer && <button onClick={() => setActiveTab('groupManagement')} className={activeTab === 'groupManagement' ? 'font-bold' : ''}>Gestione Gironi</button>}
        {isOrganizer && <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'font-bold' : ''}>Impostazioni</button>}
        {tournament.playoffs && <button onClick={() => setActiveTab('playoffs')} className={activeTab === 'playoffs' ? 'font-bold' : ''}>Playoffs</button>}
        {tournament.consolationBracket && <button onClick={() => setActiveTab('consolation')} className={activeTab === 'consolation' ? 'font-bold' : ''}>Consolation</button>}
      </div>

      <div className="animate-fadeIn">
        {activeTab === 'standings' && selectedGroup && (
          <StandingsTable group={selectedGroup} players={event.players} settings={tournament.settings} loggedInPlayerId={loggedInPlayerId} onPlayerContact={onPlayerContact} />
        )}

        {activeTab === 'matches' && selectedGroup && (
          <MatchList
            group={selectedGroup}
            players={event.players}
            onEditResult={(m, rect) => {
              // open modern editor anchored — reuse handleEditResult-like logic
              setEditingMatch(m);
              setScore1(m.score1?.toString() ?? '');
              setScore2(m.score2?.toString() ?? '');
              // scroll so anchor is visible
              if (rect) window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - 120), behavior: 'smooth' });
            }}
            onBookMatch={setBookingMatch}
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
            onPlayerContact={onPlayerContact}
            onRescheduleMatch={(m) => setRescheduleMatch(m)}
            onCancelBooking={handleCancelBooking}
            onDeleteResult={handleDeleteResult}
          />
        )}

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
            selectedGroupId={selectedGroupId ?? undefined}
            onSlotBook={handleSlotInitiatedBooking}
            onRequestReschedule={(m) => setRescheduleMatch(m)}
            onRequestCancelBooking={(m) => handleCancelBooking(m)}
          />
        )}

        {activeTab === 'chat' && <ChatPanel />}

        {activeTab === 'groupManagement' && isOrganizer && (
          <GroupManagement event={event} tournament={tournament} setEvents={setEvents} />
        )}

        {activeTab === 'settings' && isOrganizer && <TournamentSettings event={event} tournament={tournament} setEvents={setEvents} />}

        {activeTab === 'playoffs' && tournament.playoffs && <Playoffs event={event} tournament={tournament} setEvents={setEvents} isOrganizer={isOrganizer} loggedInPlayerId={loggedInPlayerId} />}

        {activeTab === 'consolation' && tournament.consolationBracket && <ConsolationBracket event={event} tournament={tournament} setEvents={setEvents} isOrganizer={isOrganizer} loggedInPlayerId={loggedInPlayerId} />}
      </div>

      {/* Modern editor: anchored near clicked button (fallback centered) */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none">
          <div className="pointer-events-auto mt-20 w-full max-w-md bg-secondary rounded-xl shadow-2xl border border-tertiary p-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-sm text-text-secondary">Risultato</div>
                <div className="font-semibold">{getPlayer(editingMatch.player1Id)?.name} vs {getPlayer(editingMatch.player2Id)?.name}</div>
              </div>
              <button onClick={() => setEditingMatch(null)} className="text-text-secondary">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <div className="flex flex-col items-center">
                <div className="text-sm text-text-secondary mb-1">{getPlayer(editingMatch.player1Id)?.name}</div>
                <input
                  type="number"
                  min={0}
                  value={score1}
                  onChange={e => setScore1(e.target.value)}
                  className="w-24 text-center border rounded p-2 text-black font-extrabold text-xl"
                />
              </div>

              <div className="flex items-center justify-center">
                <div className="text-2xl font-bold">—</div>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-sm text-text-secondary mb-1">{getPlayer(editingMatch.player2Id)?.name}</div>
                <input
                  type="number"
                  min={0}
                  value={score2}
                  onChange={e => setScore2(e.target.value)}
                  className="w-24 text-center border rounded p-2 text-black font-extrabold text-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingMatch(null)} className="bg-tertiary py-2 px-4 rounded-lg">Annulla</button>
              <button onClick={async () => {
                const s1 = parseInt(score1, 10);
                const s2 = parseInt(score2, 10);
                if (!isNaN(s1) && !isNaN(s2)) {
                  await handleUpdateMatchResult(editingMatch.id, s1, s2);
                  setEditingMatch(null);
                }
              }} className="bg-highlight py-2 px-4 rounded-lg text-white font-bold">Salva</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TournamentView;
