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
  const [slotInput, setSlotInput] = useState<{
    start: string;
    location: string;
    field: string;
  }>({ start: "", location: "", field: "" });
  const [slotError, setSlotError] = useState("");
  const [modalSlotId, setModalSlotId] = useState<string | null>(null);
  const [modalMatchId, setModalMatchId] = useState<string>("");
  const [modalBookError, setModalBookError] = useState("");

  if (!tournament || !tournament.groups) {
    return <div className="text-red-500">Dati torneo non disponibili, ricarica la pagina.</div>;
  }

  const myPendingMatches: Match[] = tournament.groups
    ? tournament.groups.flatMap(g =>
        g.matches.filter(m =>
          m.status === "pending" &&
          (m.player1Id === loggedInPlayerId || m.player2Id === loggedInPlayerId)
        )
      )
    : [];

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
  const availableSlots = globalTimeSlots.filter(slot => !allBookedSlotIds.includes(slot.id));

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
    setSlotInput({ start: "", location: "", field: "" });
  };

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

  const handleBookPendingMatchOnSlot = async () => {
    setModalBookError("");
    const slot = (event.globalTimeSlots || []).find(s => s.id === modalSlotId);
    const match = myPendingMatches.find(m => m.id === modalMatchId);
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
      slotId: slot.id
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
                    slotId: undefined
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
      {/* SEZIONE TITOLI E CARD */}
      <h2 className="text-2xl font-bold mb-4 text-accent">Gestione slot orari globali</h2>

      {isOrganizer && (
        <div className="bg-tertiary rounded-xl p-5 mb-6 shadow-lg w-full max-w-md flex flex-col gap-3">
          <h4 className="font-bold text-accent text-lg mb-1">Aggiungi nuovo slot</h4>
          <input
            type="datetime-local"
            value={slotInput.start}
            onChange={e => setSlotInput({ ...slotInput, start: e.target.value })}
            placeholder="Data e ora"
            className="input mb-2"
          />
          <input
            type="text"
            value={slotInput.location}
            onChange={e => setSlotInput({ ...slotInput, location: e.target.value })}
            placeholder="Luogo"
            className="input mb-2"
          />
          <input
            type="text"
            value={slotInput.field}
            onChange={e => setSlotInput({ ...slotInput, field: e.target.value })}
            placeholder="Campo"
            className="input mb-2"
          />
          <button
            onClick={handleAddSlot}
            className="btn-accent self-start px-5 py-1 rounded font-semibold"
          >
            Aggiungi slot
          </button>
          {slotError && <span className="text-red-600 font-semibold">{slotError}</span>}
        </div>
      )}

      <div className="bg-tertiary rounded-xl shadow-lg p-5 mb-6 w-full max-w-xl">
        <h4 className="font-bold text-accent text-lg mb-3">Slot disponibili per prenotare</h4>
        {availableSlots.length === 0 ? (
          <p className="text-gray-500">Nessuno slot libero.</p>
        ) : (
          <ul className="space-y-2">
            {availableSlots.map(slot => (
              <li key={slot.id} className="flex items-center justify-between border-b border-gray-300 pb-2">
                <div>
                  <span className="font-semibold">{slot.start}</span>{" "}
                  <span>-</span>{" "}
                  <span className="text-accent">{slot.location}</span>{" "}
                  <span>-</span>{" "}
                  <span className="text-tertiary">{slot.field}</span>
                </div>
                <div className="flex gap-2">
                  {myPendingMatches.length > 0 && (
                    <button
                      className="btn-accent px-3 py-1 rounded font-semibold"
                      onClick={() => {
                        setModalSlotId(slot.id);
                        setModalMatchId(myPendingMatches[0].id);
                      }}
                    >
                      Prenota slot
                    </button>
                  )}
                  {isOrganizer && (
                    <button
                      className="btn-tertiary px-3 py-1 rounded font-semibold"
                      onClick={() => handleDeleteSlot(slot.id)}
                    >
                      Elimina
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* MODAL PRENOTAZIONE */}
      {modalSlotId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm relative">
            <h5 className="font-bold text-accent text-xl mb-2">Prenotazione slot</h5>
            <label className="block mb-2 font-semibold">Seleziona partita</label>
            <select
              value={modalMatchId}
              onChange={e => setModalMatchId(e.target.value)}
              className="input mb-4 w-full"
            >
              <option value="">Seleziona partita</option>
              {myPendingMatches.map(m => (
                <option key={m.id} value={m.id}>
                  {m.player1Id} vs {m.player2Id}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                className="btn-accent px-4 py-1 rounded font-semibold"
                onClick={handleBookPendingMatchOnSlot}
              >
                Prenota
              </button>
              <button
                className="btn px-4 py-1 rounded font-semibold"
                onClick={() => setModalSlotId(null)}
              >
                Chiudi
              </button>
            </div>
            {modalBookError && (
              <span className="text-red-600 font-semibold mt-2 block">{modalBookError}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSlots;
