import React, { useState } from 'react';
import { type Event, type Tournament, type Match, type TimeSlot } from '../types';
import { updateDoc, doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import MatchList from './MatchList';
import TimeSlots from './TimeSlots';
// ... altri import esistenti

const TournamentView: React.FC<{
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (p: any) => void;
}> = ({ event, tournament, setEvents, isOrganizer, loggedInPlayerId, onPlayerContact }) => {
  const [bookingMatch, setBookingMatch] = useState<Match | null>(null);
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null); // NUOVO: slot-first flow
  const [rescheduleMatch, setRescheduleMatch] = useState<Match | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Funzione wrapper per aggiornare React state e Firestore (già presente nel repo)
  const handleUpdateEvents = async (updater: (prevEvents: Event[]) => Event[]) => {
    setEvents(updater);
    const updatedEvents = updater([event]);
    const updatedEvent = updatedEvents.find(e => e.id === event.id);
    if (updatedEvent) {
      await updateDoc(doc(db, "events", event.id), updatedEvent);
    }
  };

  // Flow esistente: prenotazione match -> scegli slot (unchanged)
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

  // NUOVO: Flow slot-first
  const handleSlotInitiatedBooking = (slot: TimeSlot) => {
    setBookingSlot(slot);
    setBookingMatch(null); // assicura che siamo in slot-first mode
    setBookingError(null);
  };

  // Prenota una partita (match) nel slot precedentemente selezionato usando runTransaction
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

        // trova lo slot nello snapshot
        const slotIndex = tSnapshot.timeSlots.findIndex(ts => ts.id === bookingSlot.id);
        if (slotIndex === -1) throw new Error("Slot non trovato");
        if (tSnapshot.timeSlots[slotIndex].matchId) throw new Error("Slot già prenotato");

        // cerca girone del giocatore
        const groupIndex = tSnapshot.groups.findIndex(g =>
          (g.id === (tournament as any).selectedGroupId) // preferiamo selectedGroupId se presente (TournamentView mantiene selectedGroupId)
          || (loggedInPlayerId ? g.playerIds.includes(loggedInPlayerId) : false)
        );
        if (groupIndex === -1) throw new Error("Girone del giocatore non trovato");

        const matchIndex = tSnapshot.groups[groupIndex].matches.findIndex(m => m.id === matchToBook.id);
        if (matchIndex === -1) throw new Error("Partita non trovata nel girone");
        if (tSnapshot.groups[groupIndex].matches[matchIndex].status !== 'pending') throw new Error("La partita non è più disponibile");

        // Applichiamo le modifiche all'oggetto event
        const updatedEvent = JSON.parse(JSON.stringify(currentEvent)) as Event;
        const tObj = updatedEvent.tournaments.find(tt => tt.id === tournament.id)!;
        const slotToUpdate = tObj.timeSlots.find(ts => ts.id === bookingSlot.id)!;
        slotToUpdate.matchId = matchToBook.id;

        const groupObj = tObj.groups[groupIndex];
        const matchObj = groupObj.matches.find(m => m.id === matchToBook.id)!;
        matchObj.status = 'scheduled';
        matchObj.scheduledTime = slotToUpdate.time;
        matchObj.location = slotToUpdate.location;

        // Commit atomico
        transaction.update(docRef, updatedEvent);
      });

      // aggiornamento locale dello stato React (stesso trasform usato sopra)
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

  // altre funzioni esistenti come handleRescheduleBookMatch, handleUpdateMatchResult, ecc.

  // RENDER: passiamo selectedGroupId e loggedInPlayerId a TimeSlots
  return (
    <div>
      {/* ... tab di navigazione e altro ... */}
      <TimeSlots
        event={event}
        tournament={tournament}
        setEvents={setEvents}
        isOrganizer={isOrganizer}
        loggedInPlayerId={loggedInPlayerId}
        selectedGroupId={undefined} // se hai uno selectedGroupId gestiscilo qui
        onSlotBook={handleSlotInitiatedBooking}
      />

      {/* Modal per flow slot-first */}
      {bookingSlot && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Assegna partita allo slot</h4>
            <p className="mb-4 text-text-secondary">
              Hai scelto lo slot: <strong className="text-text-primary">{new Date(bookingSlot.time).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' })} — {bookingSlot.location}</strong>
            </p>

            {/* Trova il girone dell'utente */}
            {(() => {
              const playerGroup = tournament.groups.find(g => loggedInPlayerId ? g.playerIds.includes(loggedInPlayerId) : false);
              if (!loggedInPlayerId || !playerGroup) {
                return <p className="text-text-secondary mb-4">Non sei iscritto a nessun girone in questo torneo.</p>;
              }
              const pendingMatches = playerGroup.matches.filter(m => m.status === 'pending');
              if (pendingMatches.length === 0) {
                return <p className="text-text-secondary mb-4">Nessuna partita pending nel tuo girone da assegnare a questo slot.</p>;
              }
              return (
                <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                  {pendingMatches.map(pm => (
                    <button
                      key={pm.id}
                      onClick={() => handleBookMatchWithSlot(pm)}
                      disabled={bookingLoading}
                      className="w-full text-left bg-tertiary hover:bg-highlight p-3 rounded-lg transition-colors"
                    >
                      <p>
                        {event.players.find(p => p.id === pm.player1Id)?.name} vs {event.players.find(p => p.id === pm.player2Id)?.name}
                      </p>
                      <p className="text-sm text-text-secondary">Clicca per assegnare questa partita nello slot selezionato</p>
                    </button>
                  ))}
                </div>
              );
            })()}

            {bookingError && <div className="text-red-400 mb-2">{bookingError}</div>}

            <div className="flex justify-end mt-6 gap-2">
              <button onClick={() => setBookingSlot(null)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">
                Annulla
              </button>
              <button onClick={() => setBookingSlot(null)} disabled className="bg-accent/60 text-primary font-bold py-2 px-4 rounded-lg transition-colors">
                {/* Pulsante disabled: la conferma finale avviene selezionando una partita */}
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mantengo la modal esistente per bookingMatch -> slot selection (unchanged) */}
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
              {tournament.timeSlots.filter(ts => !ts.matchId).length > 0 ? (
                tournament.timeSlots.filter(ts => !ts.matchId).map(ts => (
                  <button key={ts.id} onClick={() => handleBookMatch(ts)} className="w-full text-left bg-tertiary hover:bg-highlight p-3 rounded-lg transition-colors">
                    <p>{new Date(ts.time).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' })}</p>
                    <p className="text-sm text-text-secondary">{ts.location}</p>
                  </button>
                ))
              ) : (
                <p className="text-text-secondary text-center p-4">Nessuno slot orario disponibile. Chiedi all'organizzatore di aggiungerne.</p>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setBookingMatch(null)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">
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
