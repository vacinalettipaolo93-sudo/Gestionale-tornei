import React, { useState } from 'react';
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { type Event, type Tournament, type TimeSlot, type Match } from '../types';

interface TimeSlotsProps {
  event: Event;
  tournament?: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  selectedGroupId?: string;
  globalTimeSlots: TimeSlot[];
}

function generateSlotId() {
  return 'slot_' + Math.random().toString(36).slice(2, 10);
}

const TimeSlots: React.FC<TimeSlotsProps> = ({
  event,
  tournament,
  setEvents,
  isOrganizer,
  loggedInPlayerId,
  selectedGroupId,
  globalTimeSlots = [],
}) => {
  // Stati per aggiunta slot ORGA
  const [slotInput, setSlotInput] = useState<{
    start: string;
    location: string;
    field: string;
  }>({ start: "", location: "", field: "" });
  const [slotError, setSlotError] = useState("");

  // Stati MODAL prenotazione utente
  const [modalSlotId, setModalSlotId] = useState<string | null>(null);
  const [modalMatchId, setModalMatchId] = useState<string>("");
  const [modalBookError, setModalBookError] = useState("");

  if (!tournament || !tournament.groups) {
    return <div className="text-red-500">Dati torneo non disponibili, ricarica la pagina.</div>;
  }

  // Trova tutte le partite "pending" dell'utente
  const myPendingMatches: Match[] = tournament.groups
    ? tournament.groups.flatMap(g =>
        g.matches.filter(m =>
          m.status === "pending" &&
          (m.player1Id === loggedInPlayerId || m.player2Id === loggedInPlayerId)
        )
      )
    : [];

  // ########### NOVITÀ: FILTRO SLOT A LIVELLO EVENTO ############
  // Prendi tutti gli slot già prenotati da QUALSIASI partita di QUALSIASI torneo/girone
  const allBookedSlotIds: string[] = event.tournaments
    .flatMap(tournament =>
      tournament.groups
        ? tournament.groups.flatMap(group =>
            group.matches
              .filter(match => match.slotId && (match.status === "scheduled" || match.status === "completed"))
              .map(match => match.slotId!)
          )
        : []
    );

  // Slot disponibili: solo quelli non prenotati da nessuno
  const availableSlots = globalTimeSlots.filter(slot => !allBookedSlotIds.includes(slot.id));

  // Funzione aggiunta slot organizzatore
  const handleAddSlot = async () => {
    setSlotError("");
    if (!slotInput.start || isNaN(Date.parse(slotInput.start))) {
      setSlotError("Inserisci una data e ora valida (ISO oppure YY-MM-DD HH:mm:ss).");
      return;
    }
    if (!slotInput.location) {
      setSlotError("Inserisci il campo/luogo.");
      return;
    }
    const slotToAdd: TimeSlot = {
      id: generateSlotId(),
      start: slotInput.start,
      location: slotInput.location,
      field: slotInput.field,
    };
    const updatedGlobalSlots = [...(event.globalTimeSlots || []), slotToAdd];

    setEvents(prevEvents =>
      prevEvents.map(ev =>
        ev.id === event.id
          ? { ...ev, globalTimeSlots: updatedGlobalSlots }
          : ev
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      globalTimeSlots: updatedGlobalSlots,
    });
  };

  // Funzione elimina slot
  const handleDeleteSlot = async (slotId: string) => {
    const updatedGlobalSlots = (event.globalTimeSlots || []).filter(s => s.id !== slotId);

    setEvents(prevEvents =>
      prevEvents.map(ev =>
        ev.id === event.id
          ? { ...ev, globalTimeSlots: updatedGlobalSlots }
          : ev
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      globalTimeSlots: updatedGlobalSlots,
    });
  };

  // Funzione prenota partita su slot (utente)
  const handleBookPendingMatchOnSlot = async () => {
    setModalBookError("");
    const slot = (event.globalTimeSlots || []).find(s => s.id === modalSlotId);
    const match = myPendingMatches.find(m => m.id === modalMatchId);
    // Filtra anche lato backend! Se slot è prenotato, errore
    if (!slot || !match) {
      setModalBookError("Devi selezionare una partita.");
      return;
    }
    if (allBookedSlotIds.includes(slot.id)) {
      setModalBookError("Questo slot è già prenotato in qualche torneo/girone.");
      return;
    }
    const updatedMatch: Match = {
      ...match,
      status: "scheduled",
      scheduledTime: new Date(slot.start).toISOString(),
      location: slot.location ?? "",
      field: slot.field ?? (slot.location ?? ""),
      slotId: slot.id // AGGIUNGI slotId!
    };
    const updatedGroups = tournament.groups.map(g =>
      g.matches.some(m => m.id === match.id)
        ? { ...g, matches: g.matches.map(m => m.id === match.id ? updatedMatch : m) }
        : g
    );
    setEvents(prevEvents =>
      prevEvents.map(ev =>
        ev.id === event.id
          ? {
              ...ev,
              tournaments: ev.tournaments.map(t =>
                t.id === tournament.id ? { ...t, groups: updatedGroups } : t
              ),
            }
          : ev
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      tournaments: event.tournaments.map(t =>
        t.id === tournament.id ? { ...t, groups: updatedGroups } : t
      )
    });
    setModalSlotId(null);
    setModalMatchId("");
    setModalBookError("");
  };

  // Funzione annulla match (libera slot)
  const handleCancelMatchBooking = async (matchId: string) => {
    const updatedGroups = tournament.groups.map(g =>
      g.matches.some(m => m.id === matchId)
        ? {
            ...g,
            matches: g.matches.map(m =>
              m.id === matchId
                ? {
                    ...m,
                    status: "pending",
                    scheduledTime: null,
                    location: "",
                    field: "",
                    slotId: undefined // LIBERA lo slot!
                  }
                : m
            ),
          }
        : g
    );
    setEvents(prevEvents =>
      prevEvents.map(ev =>
        ev.id === event.id
          ? {
              ...ev,
              tournaments: ev.tournaments.map(t =>
                t.id === tournament.id ? { ...t, groups: updatedGroups } : t
              ),
            }
          : ev
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      tournaments: event.tournaments.map(t =>
        t.id === tournament.id ? { ...t, groups: updatedGroups } : t
      )
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-accent">Gestione slot orari globali</h2>

      {isOrganizer && (
        <div className="bg-tertiary rounded-xl p-4 mb-6 shadow-lg w-full max-w-md">
          <h4 className="mb-3 font-bold text-accent text-lg">Aggiungi un nuovo slot</h4>
          <input
            type="datetime-local"
            value={slotInput.start}
            onChange={e => setSlotInput({ ...slotInput, start: e.target.value })}
            placeholder="Data e ora"
            className="mb-2"
          />
          <input
            type="text"
            value={slotInput.location}
            onChange={e => setSlotInput({ ...slotInput, location: e.target.value })}
            placeholder="Luogo"
            className="mb-2"
          />
          <input
            type="text"
            value={slotInput.field}
            onChange={e => setSlotInput({ ...slotInput, field: e.target.value })}
            placeholder="Campo"
            className="mb-2"
          />
          <button onClick={handleAddSlot}>Aggiungi slot</button>
          {slotError && <div className="text-red-600">{slotError}</div>}
        </div>
      )}

      {/* Render solo slot disponibili per prenotare */}
      <div>
        <h4 className="mb-3 font-bold text-accent text-lg">Slot disponibili per prenotare</h4>
        <ul>
          {availableSlots.length === 0 ? (
            <li>Nessuno slot libero.</li>
          ) : (
            availableSlots.map(slot => (
              <li key={slot.id}>
                {slot.start} - {slot.location} - {slot.field}
                {myPendingMatches.length > 0 && (
                  <button
                    onClick={() => {
                      setModalSlotId(slot.id);
                      setModalMatchId(myPendingMatches[0].id);
                    }}
                  >
                    Prenota su questa slot
                  </button>
                )}
                {isOrganizer && (
                  <button onClick={() => handleDeleteSlot(slot.id)}>Elimina slot</button>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      {modalSlotId && (
        <div className="modal">
          <h5>Prenotazione slot</h5>
          <select
            value={modalMatchId}
            onChange={e => setModalMatchId(e.target.value)}
          >
            <option value="">Seleziona partita</option>
            {myPendingMatches.map(m => (
              <option key={m.id} value={m.id}>
                {m.player1Id} vs {m.player2Id}
              </option>
            ))}
          </select>
          <button onClick={handleBookPendingMatchOnSlot}>Prenota</button>
          <button onClick={() => setModalSlotId(null)}>Chiudi</button>
          {modalBookError && <div className="text-red-600">{modalBookError}</div>}
        </div>
      )}
    </div>
  );
};

export default TimeSlots;
