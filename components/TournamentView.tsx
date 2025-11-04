import React, { useState } from 'react';
import { type Event, type Tournament, type Match, type TimeSlot } from '../types';
import StandingsTable from './StandingsTable';
import MatchList from './MatchList';
import ParticipantsTab from './ParticipantsTab';
import GroupManagement from './GroupManagement';
import TournamentSettings from './TournamentSettings';
import Playoffs from './Playoffs';
import ConsolationBracket from './ConsolationBracket';
import PlayerManagement from './PlayerManagement';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface TournamentViewProps {
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  selectedGroupId?: string;
}

const TournamentView: React.FC<TournamentViewProps> = ({
  event, tournament, setEvents, isOrganizer, loggedInPlayerId
}) => {
  const userGroup = tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId ?? ""));
  const [selectedGroupId, setSelectedGroupId] = useState(
    userGroup ? userGroup.id : tournament.groups[0]?.id
  );
  const selectedGroup = tournament.groups.find(g => g.id === selectedGroupId);

  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'participants' | 'playoffs' | 'consolation' | 'groups' | 'settings' | 'rules' | 'players'>('standings');

  // Stati modali
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState<string>("");
  const [score2, setScore2] = useState<string>("");

  const [bookingMatch, setBookingMatch] = useState<Match | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [reschedulingMatch, setReschedulingMatch] = useState<Match | null>(null);
  const [rescheduleSlotId, setRescheduleSlotId] = useState<string>("");

  const [deletingMatch, setDeletingMatch] = useState<Match | null>(null);

  const [bookingError, setBookingError] = useState<string>("");

  // Calcolo slot già prenotati in tutti i tornei
  function getAllBookedSlotIds(): string[] {
    return event.tournaments.flatMap(tournament =>
      tournament.groups
        ? tournament.groups.flatMap(group =>
            group.matches
              .filter(match => match.slotId && (match.status === "scheduled" || match.status === "completed"))
              .map(match => match.slotId!)
          )
        : []
    );
  }

  function getAvailableSlots() {
    const globalSlots = Array.isArray(event.globalTimeSlots) ? event.globalTimeSlots : [];
    const booked = getAllBookedSlotIds();
    return globalSlots.filter(slot => !booked.includes(slot.id));
  }

  const handlePlayerContact = (player: { phone?: string }) => {
    if (player.phone)
      window.open(`https://wa.me/${player.phone.replace(/[^0-9]/g, "")}`, "_blank");
  };

  // INSERISCI/MODIFICA RISULTATO
  const handleEditResult = (match: Match) => {
    setEditingMatch(match);
    setScore1(match.score1 !== null ? String(match.score1) : "");
    setScore2(match.score2 !== null ? String(match.score2) : "");
  };
  async function saveMatchResult(match: Match) {
    if (!selectedGroup) return;
    const updatedMatch = { ...match, score1: Number(score1), score2: Number(score2), status: "completed" };
    const updatedGroups = tournament.groups.map(g =>
      g.id === selectedGroup.id
        ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) }
        : g
    );
    const updatedTournaments = event.tournaments.map(t =>
      t.id === tournament.id ? { ...t, groups: updatedGroups } : t
    );
    setEvents(prevEvents =>
      prevEvents.map(e =>
        e.id === event.id
          ? {
            ...e,
            tournaments: updatedTournaments
          }
          : e
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      tournaments: updatedTournaments
    });
    setEditingMatch(null);
    setScore1("");
    setScore2("");
  }

  // ELIMINA RISULTATO
  async function deleteMatchResult(match: Match) {
    if (!selectedGroup) return;
    const updatedMatch: Match = {
      ...match,
      score1: null,
      score2: null,
      status: "pending",
    };
    const updatedGroups = tournament.groups.map(g =>
      g.id === selectedGroup.id
        ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) }
        : g
    );
    const updatedTournaments = event.tournaments.map(t =>
      t.id === tournament.id ? { ...t, groups: updatedGroups } : t
    );
    setEvents(prevEvents =>
      prevEvents.map(e =>
        e.id === event.id
          ? {
            ...e,
            tournaments: updatedTournaments
          }
          : e
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      tournaments: updatedTournaments
    });
    setDeletingMatch(null);
  }

  // PRENOTA
  const handleBookMatch = (match: Match) => {
    setBookingMatch(match);
    setSelectedSlotId("");
    setBookingError("");
  };
  async function saveMatchBooking(match: Match) {
    if (!selectedGroup) return;
    const globalSlots = Array.isArray(event.globalTimeSlots) ? event.globalTimeSlots : [];
    const allBookedSlotIds = getAllBookedSlotIds();
    if (!selectedSlotId) {
      setBookingError("Seleziona uno slot orario.");
      return;
    }
    if (allBookedSlotIds.includes(selectedSlotId)) {
      setBookingError("Slot già prenotato, scegli un altro slot.");
      return;
    }
    const timeSlot = globalSlots.find(s => s.id === selectedSlotId);
    if (!timeSlot) {
      setBookingError("Slot non trovato tra quelli globali.");
      return;
    }
    const dateObj = new Date(timeSlot.start);
    if (!timeSlot.start || isNaN(dateObj.getTime())) {
      setBookingError("Invalid data - campo orario non valido.");
      return;
    }
    const updatedMatch: Match = {
      ...match,
      status: "scheduled",
      scheduledTime: dateObj.toISOString(),
      slotId: timeSlot.id,
      location: timeSlot.location ?? "",
      field: timeSlot.field ?? (timeSlot.location ?? ""),
    };

    const updatedGroups = tournament.groups.map(g =>
      g.id === selectedGroup.id
        ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) }
        : g
    );
    const updatedTournaments = event.tournaments.map(t =>
      t.id === tournament.id ? { ...t, groups: updatedGroups } : t
    );
    setEvents(prevEvents =>
      prevEvents.map(e =>
        e.id === event.id
          ? {
            ...e,
            tournaments: updatedTournaments
          }
          : e
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      tournaments: updatedTournaments
    });
    setBookingMatch(null);
    setSelectedSlotId("");
    setBookingError("");
  }

  // MODIFICA PRENOTAZIONE
  const handleRescheduleMatch = (match: Match) => {
    setReschedulingMatch(match);
    setRescheduleSlotId("");
  };
  async function saveRescheduleMatch(match: Match) {
    if (!selectedGroup) return;
    const globalSlots = Array.isArray(event.globalTimeSlots) ? event.globalTimeSlots : [];
    const allBookedSlotIds = getAllBookedSlotIds();
    if (!rescheduleSlotId) return;
    if (allBookedSlotIds.includes(rescheduleSlotId)) {
      setBookingError("Slot già prenotato da un'altra partita.");
      return;
    }
    const timeSlot = globalSlots.find(s => s.id === rescheduleSlotId);
    const dateObj = timeSlot ? new Date(timeSlot.start) : null;
    const updatedMatch: Match = {
      ...match,
      scheduledTime: timeSlot?.start ? dateObj?.toISOString() ?? "" : "",
      slotId: timeSlot?.id ?? "",
      location: timeSlot?.location ?? "",
      field: timeSlot?.field ?? (timeSlot?.location ?? ""),
    };
    const updatedGroups = tournament.groups.map(g =>
      g.id === selectedGroup.id
        ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) }
        : g
    );
    const updatedTournaments = event.tournaments.map(t =>
      t.id === tournament.id ? { ...t, groups: updatedGroups } : t
    );
    setEvents(prevEvents =>
      prevEvents.map(e =>
        e.id === event.id
          ? {
            ...e,
            tournaments: updatedTournaments
          }
          : e
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      tournaments: updatedTournaments
    });
    setReschedulingMatch(null);
    setRescheduleSlotId("");
    setBookingError("");
  }

  // ANNULLA PRENOTAZIONE - QUESTA È LA FUNZIONE CON LA CORREZIONE!
  async function handleCancelBooking(match: Match) {
    if (!selectedGroup) return;
    const updatedMatch: Match = {
      ...match,
      status: "pending",
      scheduledTime: undefined,
      slotId: undefined,
      location: "",
      field: "",
    };
    const updatedGroups = tournament.groups.map(g =>
      g.id === selectedGroup.id
        ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) }
        : g
    );
    const updatedTournaments = event.tournaments.map(t =>
      t.id === tournament.id ? { ...t, groups: updatedGroups } : t
    );
    setEvents(prevEvents =>
      prevEvents.map(e =>
        e.id === event.id
          ? {
            ...e,
            tournaments: updatedTournaments
          }
          : e
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      tournaments: updatedTournaments
    });
  }

  const modalBg = "fixed inset-0 bg-black/70 flex items-center justify-center z-50";
  const modalBox = "bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary";

  return (
    <div>
      {/* Tabs menu */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {/* ...Bottoni tab identici a quelli delle risposte sopra... */}
        <button onClick={() => setActiveTab('standings')}
          className={`px-4 py-2 rounded-full ${activeTab === 'standings'
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
            : 'bg-transparent text-accent'
          }`}
        >
          Classifica
        </button>
        <button onClick={() => setActiveTab('matches')}
          className={`px-4 py-2 rounded-full ${activeTab === 'matches'
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
            : 'bg-transparent text-accent'
          }`}
        >
          Partite
        </button>
        {!isOrganizer && (
          <button onClick={() => setActiveTab('participants')}
            className={`px-4 py-2 rounded-full ${activeTab === 'participants'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
              : 'bg-transparent text-accent'
            }`}
          >
            Partecipanti
          </button>
        )}
        <button onClick={() => setActiveTab('playoffs')}
          className={`px-4 py-2 rounded-full ${activeTab === 'playoffs'
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
            : 'bg-transparent text-accent'
          }`}
        >
          Playoff
        </button>
        <button onClick={() => setActiveTab('consolation')}
          className={`px-4 py-2 rounded-full ${activeTab === 'consolation'
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
            : 'bg-transparent text-accent'
          }`}
        >
          Consolazione
        </button>
        {isOrganizer && (
          <>
            <button onClick={() => setActiveTab('groups')}
              className={`px-4 py-2 rounded-full ${activeTab === 'groups'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                : 'bg-transparent text-accent'
              }`}
            >
              Gestione Gironi
            </button>
            <button onClick={() => setActiveTab('players')}
              className={`px-4 py-2 rounded-full ${activeTab === 'players'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                : 'bg-transparent text-accent'
              }`}
            >
              Giocatori
            </button>
          </>
        )}
        <button onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-full ${activeTab === 'rules'
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
            : 'bg-transparent text-accent'
          }`}
        >
          Regolamento
        </button>
        {isOrganizer && (
          <button onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-full ${activeTab === 'settings'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
              : 'bg-transparent text-accent'
            }`}
          >
            Impostazioni
          </button>
        )}
      </div>

      {/* Selettore gironi */}
      {selectedGroup && (
        <div className="mb-6 flex items-center gap-3">
          <label className="font-bold text-text-secondary">Seleziona Girone:</label>
          <select
            value={selectedGroupId}
            onChange={e => setSelectedGroupId(e.target.value)}
            className="bg-tertiary rounded px-3 py-2 font-semibold"
          >
            {tournament.groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        {activeTab === 'standings' && selectedGroup && (
          <div>
            <h3 className="text-xl font-bold mb-3 text-accent">{selectedGroup.name}</h3>
            <StandingsTable
              group={selectedGroup}
              players={event.players}
              settings={tournament.settings}
              loggedInPlayerId={loggedInPlayerId}
              onPlayerContact={handlePlayerContact}
            />
          </div>
        )}

        {activeTab === 'matches' && selectedGroup && (
          <div>
            <h3 className="text-xl font-bold mb-3 text-accent">{selectedGroup.name}</h3>
            <MatchList
              group={selectedGroup}
              players={event.players}
              onEditResult={handleEditResult}
              onBookMatch={handleBookMatch}
              isOrganizer={isOrganizer}
              loggedInPlayerId={loggedInPlayerId}
              onPlayerContact={handlePlayerContact}
              onRescheduleMatch={handleRescheduleMatch}
              onCancelBooking={handleCancelBooking}
              onDeleteResult={match => setDeletingMatch(match)}
              viewingOwnGroup={selectedGroup.playerIds.includes(loggedInPlayerId ?? "")}
            />

            {/* Modale INSERISCI/MODIFICA RISULTATO */}
            {editingMatch && (
              <div className={modalBg}>
                <div className={modalBox}>
                  <h4 className="mb-4 font-bold text-lg text-accent">Modifica Risultato</h4>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col">
                      <label className="font-bold mb-1 text-white">Risultato per {event.players.find(p => p.id === editingMatch.player1Id)?.name}</label>
                      <input
                        type="number"
                        min="0"
                        value={score1}
                        onChange={e => setScore1(e.target.value)}
                        className="border px-3 py-2 rounded font-bold text-white bg-primary"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="font-bold mb-1 text-white">Risultato per {event.players.find(p => p.id === editingMatch.player2Id)?.name}</label>
                      <input
                        type="number"
                        min="0"
                        value={score2}
                        onChange={e => setScore2(e.target.value)}
                        className="border px-3 py-2 rounded font-bold text-white bg-primary"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-3">
                      <button
                        onClick={() => setEditingMatch(null)}
                        className="bg-tertiary px-4 py-2 rounded"
                      >Annulla</button>
                      <button
                        disabled={score1 === "" || score2 === ""}
                        onClick={async () => { await saveMatchResult(editingMatch); setEditingMatch(null); }}
                        className="bg-highlight text-white px-4 py-2 rounded"
                      >Salva</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modale ELIMINA RISULTATO */}
            {deletingMatch && (
              <div className={modalBg}>
                <div className={modalBox}>
                  <h4 className="mb-4 font-bold text-lg text-red-600">Elimina risultato partita</h4>
                  <p className="mb-6 font-bold text-white">Sei sicuro di voler eliminare il risultato della partita tra&nbsp;
                    <strong>{event.players.find(p => p.id === deletingMatch.player1Id)?.name}</strong> e&nbsp;
                    <strong>{event.players.find(p => p.id === deletingMatch.player2Id)?.name}</strong>?
                  </p>
                  <div className="flex gap-2 justify-end pt-3">
                    <button
                      onClick={() => setDeletingMatch(null)}
                      className="bg-tertiary px-4 py-2 rounded"
                    >Annulla</button>
                    <button
                      onClick={async () => { await deleteMatchResult(deletingMatch); setDeletingMatch(null);}}
                      className="bg-red-600 text-white px-4 py-2 rounded"
                    >Elimina</button>
                  </div>
                </div>
              </div>
            )}

            {/* Modale PRENOTA */}
            {bookingMatch && (
              <div className={modalBg}>
                <div className={modalBox}>
                  <h4 className="mb-4 font-bold text-lg text-accent">Prenota Partita</h4>
                  <div className="flex flex-col gap-4">
                    <label className="font-bold mb-1 text-white">Scegli uno slot libero:</label>
                    <select
                      value={selectedSlotId}
                      onChange={e => { setSelectedSlotId(e.target.value); setBookingError(""); }}
                      className="border px-3 py-2 rounded font-bold text-white bg-primary"
                    >
                      <option value="">Seleziona uno slot</option>
                      {getAvailableSlots().map(slot => (
                        <option key={slot.id} value={slot.id}>
                          {new Date(slot.start).toLocaleString("it-IT")}{slot.location ? ` - ${slot.location}` : ""}{slot.field ? ` - ${slot.field}` : ""}
                        </option>
                      ))}
                    </select>
                    {bookingError && <div className="text-red-500 font-bold">{bookingError}</div>}
                    <div className="flex gap-2 justify-end pt-3">
                      <button
                        onClick={() => {setBookingMatch(null);setBookingError("");}}
                        className="bg-tertiary px-4 py-2 rounded"
                      >Annulla</button>
                      <button
                        disabled={!selectedSlotId}
                        onClick={async () => { await saveMatchBooking(bookingMatch); setBookingMatch(null);}}
                        className="bg-highlight text-white px-4 py-2 rounded"
                      >Prenota</button>
                    </div>
                    {getAvailableSlots().length === 0 &&
                      <p className="text-text-secondary mt-2">Nessuno slot disponibile, chiedi all'organizzatore di aggiungere slot!</p>
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Modale MODIFICA PRENOTAZIONE */}
            {reschedulingMatch && (
              <div className={modalBg}>
                <div className={modalBox}>
                  <h4 className="mb-4 font-bold text-lg text-accent">Modifica Prenotazione</h4>
                  <div className="flex flex-col gap-4">
                    <label className="font-bold mb-1 text-white">Scegli uno slot libero:</label>
                    <select
                      value={rescheduleSlotId}
                      onChange={e => setRescheduleSlotId(e.target.value)}
                      className="border px-3 py-2 rounded font-bold text-white bg-primary"
                    >
                      <option value="">Seleziona uno slot</option>
                      {getAvailableSlots().map(slot => (
                        <option key={slot.id} value={slot.id}>
                          {new Date(slot.start).toLocaleString("it-IT")}{slot.location ? ` - ${slot.location}` : ""}{slot.field ? ` - ${slot.field}` : ""}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 justify-end pt-3">
                      <button
                        onClick={() => setReschedulingMatch(null)}
                        className="bg-tertiary px-4 py-2 rounded"
                      >Annulla</button>
                      <button
                        disabled={!rescheduleSlotId}
                        onClick={async () => { await saveRescheduleMatch(reschedulingMatch); setReschedulingMatch(null);}}
                        className="bg-highlight text-white px-4 py-2 rounded"
                      >Salva</button>
                    </div>
                    {getAvailableSlots().length === 0 &&
                      <p className="text-text-secondary mt-2">Nessuno slot disponibile, chiedi all'organizzatore di aggiungere slot!</p>
                    }
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {activeTab === 'participants' && !isOrganizer && (
          <ParticipantsTab event={event} tournament={tournament} loggedInPlayerId={loggedInPlayerId} />
        )}

        {activeTab === 'playoffs' && (
          <Playoffs event={event} tournament={tournament} setEvents={setEvents} />
        )}
        {activeTab === 'consolation' && (
          <ConsolationBracket event={event} tournament={tournament} setEvents={setEvents} isOrganizer={isOrganizer} loggedInPlayerId={loggedInPlayerId} />
        )}
        {activeTab === 'groups' && isOrganizer && (
          <GroupManagement event={event} tournament={tournament} setEvents={setEvents} isOrganizer={isOrganizer} />
        )}
        {activeTab === 'players' && isOrganizer && (
          <PlayerManagement event={event} setEvents={setEvents} isOrganizer={isOrganizer} onPlayerContact={handlePlayerContact} />
        )}
        {activeTab === 'settings' && isOrganizer && (
          <TournamentSettings event={event} tournament={tournament} setEvents={setEvents} />
        )}
        {activeTab === 'rules' && (
          <div className="bg-secondary p-6 rounded-xl shadow-lg max-w-3xl mx-auto whitespace-pre-line">
            <h3 className="text-xl font-bold mb-4 text-accent">Regolamento Torneo</h3>
            {event.rules?.trim()
              ? <div className="bg-primary p-4 rounded-lg border border-tertiary">{event.rules}</div>
              : <p className="text-text-secondary">Nessun regolamento inserito dall'organizzatore.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentView;
