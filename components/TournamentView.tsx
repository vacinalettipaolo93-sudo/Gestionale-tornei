import React, { useState, useEffect } from 'react';
import { type Event, type Tournament, type Match, type TimeSlot, type Player } from '../types';
import StandingsTable from './StandingsTable';
import MatchList from './MatchList';
import ParticipantsTab from './ParticipantsTab';
import GroupManagement from './GroupManagement';
import TournamentSettings from './TournamentSettings';
import Playoffs from './Playoffs';
import ConsolationBracket from './ConsolationBracket';
import PlayerManagement from './PlayerManagement';
import PlayoffBracketBuilder from './PlayoffBracketBuilder';
import AvailableSlotsList from './AvailableSlotsList';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface TournamentViewProps {
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  initialActiveTab?: 'standings' | 'matches' | 'slot' | 'participants' | 'playoffs' | 'consolation' | 'groups' | 'settings' | 'rules' | 'players';
  initialSelectedGroupId?: string;
  onPlayerContact?: (player: Player | { phone?: string }) => void;
}

const TournamentView: React.FC<TournamentViewProps> = ({
  event, tournament, setEvents, isOrganizer, loggedInPlayerId,
  initialActiveTab, initialSelectedGroupId, onPlayerContact
}) => {
  const userGroup = tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId ?? ""));
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(
    initialSelectedGroupId ?? (userGroup ? userGroup.id : tournament.groups[0]?.id)
  );
  const selectedGroup = tournament.groups.find(g => g.id === selectedGroupId);

  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'slot' | 'participants' | 'playoffs' | 'consolation' | 'groups' | 'settings' | 'rules' | 'players'>(
    (initialActiveTab ?? 'standings') as any
  );

  useEffect(() => {
    if (initialActiveTab) setActiveTab(initialActiveTab as any);
  }, [initialActiveTab]);

  useEffect(() => {
    if (initialSelectedGroupId && tournament.groups.some(g => g.id === initialSelectedGroupId)) {
      setSelectedGroupId(initialSelectedGroupId);
    }
  }, [initialSelectedGroupId, tournament.groups]);

  // modali / stati
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState<string>("");
  const [score2, setScore2] = useState<string>("");

  const [bookingMatch, setBookingMatch] = useState<Match | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [reschedulingMatch, setReschedulingMatch] = useState<Match | null>(null);
  const [rescheduleSlotId, setRescheduleSlotId] = useState<string>("");

  const [deletingMatch, setDeletingMatch] = useState<Match | null>(null);

  const [bookingError, setBookingError] = useState<string>("");

  // AGGIUNTA: prenotazione dal tab Slot Disponibili
  const [slotToBook, setSlotToBook] = useState<null | TimeSlot>(null);
  const myPendingMatches = selectedGroup
    ? selectedGroup.matches.filter(m =>
        m.status === "pending" &&
        (m.player1Id === loggedInPlayerId || m.player2Id === loggedInPlayerId))
    : [];
  const handleClickBookSlot = (slot: TimeSlot) => setSlotToBook(slot);

  const handleConfirmBookSlot = async (matchId: string) => {
    const match = selectedGroup?.matches.find(m => m.id === matchId);
    if (!match || !slotToBook) return;
    setBookingError("");
    const updatedMatch: Match = {
      ...match,
      status: "scheduled",
      scheduledTime: new Date(slotToBook.start).toISOString(),
      location: slotToBook.location ?? "",
      field: slotToBook.field ?? (slotToBook.location ?? ""),
      slotId: slotToBook.id
    };
    const updatedGroups = tournament.groups.map(g =>
      g.id === selectedGroup?.id
        ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) }
        : g
    );
    const updatedTournaments = event.tournaments.map(t =>
      t.id === tournament.id ? { ...t, groups: updatedGroups } : t
    );
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, tournaments: updatedTournaments } : e));
    await updateDoc(doc(db, "events", event.id), { tournaments: updatedTournaments });
    setSlotToBook(null);
  };

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

  const handlePlayerContact = (player: { phone?: string } | Player) => {
    const p = player as Player;
    if (onPlayerContact) {
      onPlayerContact(p);
      return;
    }
    if ((p as any).phone) {
      window.open(`https://wa.me/${(p as any).phone.replace(/[^0-9]/g, "")}`, "_blank");
    }
  };

  // risultato (modifica / salva)
  const handleEditResult = (match: Match) => {
    setEditingMatch(match);
    setScore1(match.score1 !== null ? String(match.score1) : "");
    setScore2(match.score2 !== null ? String(match.score2) : "");
  };
  async function saveMatchResult(match: Match) {
    if (!selectedGroup) return;
    const updatedMatch = { ...match, score1: Number(score1), score2: Number(score2), status: "completed" };
    const updatedGroups = tournament.groups.map(g =>
      g.id === selectedGroup.id ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) } : g
    );
    const updatedTournaments = event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t);
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, tournaments: updatedTournaments } : e));
    await updateDoc(doc(db, "events", event.id), { tournaments: updatedTournaments });
    setEditingMatch(null);
    setScore1("");
    setScore2("");
  }

  // elimina risultato
  async function deleteMatchResult(match: Match) {
    if (!selectedGroup) return;
    const updatedMatch: Match = { ...match, score1: null, score2: null, status: "pending" };
    const updatedGroups = tournament.groups.map(g =>
      g.id === selectedGroup.id ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) } : g
    );
    const updatedTournaments = event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t);
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, tournaments: updatedTournaments } : e));
    await updateDoc(doc(db, "events", event.id), { tournaments: updatedTournaments });
    setDeletingMatch(null);
  }

  // booking
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
      g.id === selectedGroup.id ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) } : g
    );
    const updatedTournaments = event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t);
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, tournaments: updatedTournaments } : e));
    await updateDoc(doc(db, "events", event.id), { tournaments: updatedTournaments });
    setBookingMatch(null);
    setSelectedSlotId("");
    setBookingError("");
  }

  // reschedule
  const handleRescheduleMatch = (match: Match) => {
    setReschedulingMatch(match);
    setRescheduleSlotId("");
  };
  async function saveRescheduleMatch(match: Match) {
    if (!selectedGroup) return;
    const globalSlots = Array.isArray(event.globalTimeSlots) ? event.globalTimeSlots : [];
    const allBookedSlotIds = getAllBookedSlotIds();
    if (!rescheduleSlotId) {
      setBookingError("Seleziona uno slot orario.");
      return;
    }
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
      g.id === selectedGroup.id ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) } : g
    );
    const updatedTournaments = event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t);
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, tournaments: updatedTournaments } : e));
    await updateDoc(doc(db, "events", event.id), { tournaments: updatedTournaments });
    setReschedulingMatch(null);
    setRescheduleSlotId("");
    setBookingError("");
  }

  // cancel booking
  async function handleCancelBooking(match: Match) {
    if (!selectedGroup) return;
    const updatedMatch: Match = { ...match, status: "pending", scheduledTime: null, slotId: null, location: "", field: "" };
    const updatedGroups = tournament.groups.map(g =>
      g.id === selectedGroup.id ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) } : g
    );
    const updatedTournaments = event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t);
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, tournaments: updatedTournaments } : e));
    await updateDoc(doc(db, "events", event.id), { tournaments: updatedTournaments });
  }

  const modalBg = "fixed inset-0 bg-black/70 flex items-center justify-center z-50";
  const modalBox = "bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary";

  return (
    <div>
      {/* Tabs menu */}
      <div className="flex gap-2 mb-6 flex-wrap">
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
        {/* AGGIUNTA: Tab Slot Disponibili */}
        <button onClick={() => setActiveTab('slot')}
          className={`px-4 py-2 rounded-full ${activeTab === 'slot'
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
            : 'bg-transparent text-accent'
          }`}
        >
          Slot Disponibili
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

            {/* Booking modal */}
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
                        onClick={() => { setBookingMatch(null); setBookingError(""); setSelectedSlotId(""); }}
                        className="bg-tertiary px-4 py-2 rounded"
                      >
                        Annulla
                      </button>
                      <button
                        disabled={!selectedSlotId}
                        onClick={async () => { if (bookingMatch) { await saveMatchBooking(bookingMatch); } }}
                        className="bg-highlight text-white px-4 py-2 rounded"
                      >
                        Prenota
                      </button>
                    </div>
                    {getAvailableSlots().length === 0 &&
                      <p className="text-text-secondary mt-2">Nessuno slot disponibile, chiedi all'organizzatore di aggiungere slot!</p>
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Reschedule modal */}
            {reschedulingMatch && (
              <div className={modalBg}>
                <div className={modalBox}>
                  <h4 className="mb-4 font-bold text-lg text-accent">Modifica Prenotazione</h4>
                  <div className="flex flex-col gap-4">
                    <label className="font-bold mb-1 text-white">Scegli uno slot libero:</label>
                    <select
                      value={rescheduleSlotId}
                      onChange={e => { setRescheduleSlotId(e.target.value); setBookingError(""); }}
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
                        onClick={() => { setReschedulingMatch(null); setRescheduleSlotId(""); setBookingError(""); }}
                        className="bg-tertiary px-4 py-2 rounded"
                      >
                        Annulla
                      </button>
                      <button
                        disabled={!rescheduleSlotId}
                        onClick={async () => { if (reschedulingMatch) { await saveRescheduleMatch(reschedulingMatch); } }}
                        className="bg-highlight text-white px-4 py-2 rounded"
                      >
                        Salva
                      </button>
                    </div>
                    {getAvailableSlots().length === 0 &&
                      <p className="text-text-secondary mt-2">Nessuno slot disponibile, chiedi all'organizzatore di aggiungere slot!</p>
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Delete result confirmation modal */}
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
                      onClick={async () => { if (deletingMatch) { await deleteMatchResult(deletingMatch); } }}
                      className="bg-red-600 text-white px-4 py-2 rounded"
                    >Elimina</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Slot Disponibili */}
        {activeTab === 'slot' && (
          <>
            <AvailableSlotsList
              event={event}
              tournament={tournament}
              userId={loggedInPlayerId}
              onClickBook={handleClickBookSlot}
              matchesPending={myPendingMatches}
            />
            {slotToBook && myPendingMatches.length > 0 && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                <div className="bg-secondary p-6 rounded-xl shadow-lg w-full max-w-sm border border-tertiary">
                  <h4 className="mb-4 font-bold text-lg text-accent">Prenota Slot</h4>
                  <div className="mb-2">
                    <span className="font-semibold">Slot:</span> {new Date(slotToBook.start).toLocaleString('it-IT')}
                    {slotToBook.location && <> – <span className="font-semibold">{slotToBook.location}</span></>}
                    {slotToBook.field && <> – <span>{slotToBook.field}</span></>}
                  </div>
                  <div className="flex flex-col gap-4 mt-2">
                    <span className="font-semibold mb-2">Scegli partita da prenotare:</span>
                    {myPendingMatches.map(m => (
                      <button
                        key={m.id}
                        className="w-full bg-accent hover:bg-highlight text-white rounded-lg px-4 py-2 mb-2 font-bold"
                        onClick={() => handleConfirmBookSlot(m.id)}
                      >
                        {event.players.find(p => p.id === m.player1Id)?.name} vs {event.players.find(p => p.id === m.player2Id)?.name}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setSlotToBook(null)} className="mt-4 bg-tertiary px-4 py-2 rounded">Annulla</button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'participants' && !isOrganizer && (
          <ParticipantsTab event={event} tournament={tournament} loggedInPlayerId={loggedInPlayerId} />
        )}

        {activeTab === 'playoffs' && isOrganizer && (
          <PlayoffBracketBuilder
            event={event}
            tournament={tournament}
            setEvents={setEvents}
            isOrganizer={isOrganizer}
          />
        )}
        {activeTab === 'playoffs' && !isOrganizer && tournament.playoffs?.isGenerated && (
          <div className="bg-secondary p-6 rounded-xl shadow-lg max-w-3xl mx-auto">
            <Playoffs event={event} tournament={tournament} setEvents={setEvents} />
          </div>
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
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4 text-accent">
                Regolamento Girone: {selectedGroup?.name}
              </h3>
              {selectedGroup?.rules?.trim()
                ? <div className="bg-primary p-4 rounded-lg border border-tertiary">{selectedGroup.rules}</div>
                : <p className="text-text-secondary">Nessun regolamento inserito per questo girone.</p>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentView;
