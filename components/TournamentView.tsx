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
import { updateDoc, doc, addDoc, collection } from "firebase/firestore";

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
    // Salvataggio separato risultati
    await addDoc(collection(db, "results"), {
      eventId: event.id,
      tournamentId: tournament.id,
      groupId: selectedGroup.id,
      matchId: match.id,
      score1: updatedMatch.score1,
      score2: updatedMatch.score2,
      player1Id: updatedMatch.player1Id,
      player2Id: updatedMatch.player2Id,
      enteredBy: loggedInPlayerId,
      enteredAt: new Date().toISOString(),
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
    // Salvataggio separato eliminazione risultati
    await addDoc(collection(db, "results"), {
      eventId: event.id,
      tournamentId: tournament.id,
      groupId: selectedGroup.id,
      matchId: match.id,
      score1: null,
      score2: null,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      deletedBy: loggedInPlayerId,
      deletedAt: new Date().toISOString(),
      deleted: true
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
    // Salvataggio separato prenotazione
    await addDoc(collection(db, "bookings"), {
      eventId: event.id,
      tournamentId: tournament.id,
      groupId: selectedGroup.id,
      matchId: match.id,
      slotId: timeSlot.id,
      scheduledTime: updatedMatch.scheduledTime,
      location: updatedMatch.location,
      field: updatedMatch.field,
      bookedBy: loggedInPlayerId,
      bookedAt: new Date().toISOString(),
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
    // Salvataggio separato modifica prenotazione
    await addDoc(collection(db, "bookings"), {
      eventId: event.id,
      tournamentId: tournament.id,
      groupId: selectedGroup.id,
      matchId: match.id,
      slotId: timeSlot?.id ?? "",
      scheduledTime: updatedMatch.scheduledTime,
      location: updatedMatch.location,
      field: updatedMatch.field,
      rescheduledBy: loggedInPlayerId,
      rescheduledAt: new Date().toISOString(),
      isRescheduled: true
    });
    setReschedulingMatch(null);
    setRescheduleSlotId("");
    setBookingError("");
  }

  // ANNULLA PRENOTAZIONE
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
    // Salvataggio separato annullamento prenotazione
    await addDoc(collection(db, "bookings"), {
      eventId: event.id,
      tournamentId: tournament.id,
      groupId: selectedGroup.id,
      matchId: match.id,
      slotId: match.slotId ?? "",
      cancelledBy: loggedInPlayerId,
      cancelledAt: new Date().toISOString(),
      isCancelled: true
    });
  }

  // MODAL CSS
  const modalBg = "fixed inset-0 bg-black/70 flex items-center justify-center z-50";
  const modalBox = "bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary";

  return (
    <div>
      {/* Tabs menu */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {/* ...I TUOI BUTTONS TAB... */}
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

      {/* --- MODALI --- */}
      {editingMatch && (
        <div className={modalBg}>
          <div className={modalBox}>
            <h4 className="text-lg font-bold mb-4">Inserisci Risultato</h4>
            <div className="flex justify-between gap-4 mb-6">
              <span className="font-semibold">{editingMatch.player1Id}</span>
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
              <span className="font-semibold">{editingMatch.player2Id}</span>
            </div>
            <div className="flex justify-end gap-4 mt-8">
              <button className="px-4 py-2" onClick={() => setEditingMatch(null)}>
                Annulla
              </button>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded-lg"
                onClick={() => saveMatchResult(editingMatch)}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODALE PRENOTA PARTITA */}
      {bookingMatch && (
        <div className={modalBg}>
          <div className={modalBox}>
            <h4 className="text-lg font-bold mb-4">Prenota partita</h4>
            <select
              value={selectedSlotId}
              onChange={e => setSelectedSlotId(e.target.value)}
              className="w-full p-2 mb-4 bg-gray-100 rounded-lg"
            >
              <option value="">Seleziona uno slot...</option>
              {event.globalTimeSlots?.map((slot: any) => (
                <option key={slot.id} value={slot.id}>
                  {slot.start ? new Date(slot.start).toLocaleString() : ""} {slot.location || ""}
                </option>
              ))}
            </select>
            {bookingError && <div className="text-red-600 mb-2">{bookingError}</div>}
            <div className="flex justify-end gap-4 mt-8">
              <button className="px-4 py-2" onClick={() => setBookingMatch(null)}>
                Annulla
              </button>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                onClick={() => saveMatchBooking(bookingMatch)}
              >
                Prenota
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Altre modali (reschedule, delete, ecc) puoi inserirle qui allo stesso modo */}
    </div>
  );
};

export default TournamentView;
