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

  // Patch: INSERISCI/MODIFICA RISULTATO (salva anche su 'results')
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
    // Nuovo salvataggio separato anche su 'results'
    try {
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
    } catch (error) {
      console.error("Errore salvataggio su results:", error);
    }
    setEditingMatch(null);
    setScore1("");
    setScore2("");
  }

  // Patch: ELIMINA RISULTATO (salva anche su 'results')
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
    // Nuovo salvataggio separato anche su 'results'
    try {
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
        deleted: true,
      });
    } catch (error) {
      console.error("Errore salvataggio su results:", error);
    }
    setDeletingMatch(null);
  }

  // Patch: PRENOTA (salva anche su 'bookings')
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
      tournaments: updatedTournaments,
    });
    // Salva anche su 'bookings'
    try {
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
    } catch (error) {
      console.error("Errore salvataggio su bookings:", error);
    }
    setBookingMatch(null);
    setSelectedSlotId("");
    setBookingError("");
  }

  // Patch: MODIFICA PRENOTAZIONE (salva anche su 'bookings')
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
      tournaments: updatedTournaments,
    });
    // Salvataggio separato anche su 'bookings'
    try {
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
        isRescheduled: true,
      });
    } catch (error) {
      console.error("Errore salvataggio su bookings:", error);
    }
    setReschedulingMatch(null);
    setRescheduleSlotId("");
    setBookingError("");
  }

  // Patch: ANNULLA PRENOTAZIONE (salva anche su 'bookings')
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
      tournaments: updatedTournaments,
    });
    // Salva su bookings
    try {
      await addDoc(collection(db, "bookings"), {
        eventId: event.id,
        tournamentId: tournament.id,
        groupId: selectedGroup.id,
        matchId: match.id,
        slotId: match.slotId ?? "",
        cancelledBy: loggedInPlayerId,
        cancelledAt: new Date().toISOString(),
        isCancelled: true,
      });
    } catch (error) {
      console.error("Errore salvataggio su bookings:", error);
    }
  }

  // TUTTO IL RESTO DEL FILE rimane invariato!
  // Tutti i JSX, tabs, modali, logica di visualizzazione etc. sono lasciati IDENTICI.

  const modalBg = "fixed inset-0 bg-black/70 flex items-center justify-center z-50";
  const modalBox = "bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary";

  return (
    // Tutto il resto invariato, come nel tuo file! 👇
    <div>
      {/* ... omesso per brevità, lascia INVARIATO il JSX sotto ... */}
      {/* Copia tutto dal file che hai già, non c'è nulla da cambiare qui! */}
    </div>
  );
};

export default TournamentView;
