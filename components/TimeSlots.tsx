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

  // Safety: non fare nulla se non c'è tournament/groups
  if (!tournament || !tournament.groups) {
    return <div className="text-red-500">Dati torneo non disponibili, ricarica la pagina.</div>;
  }

  // Prendi tutte le partite "pending" dell'utente
  const myPendingMatches: Match[] = tournament.groups
    ? tournament.groups.flatMap(g =>
        g.matches.filter(m =>
          m.status === "pending" &&
          (m.player1Id === loggedInPlayerId || m.player2Id === loggedInPlayerId)
        )
      )
    : [];

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
    if (!slot || !match) {
      setModalBookError("Devi selezionare una partita.");
      return;
    }
    const updatedMatch: Match = {
      ...match,
      status: "scheduled",
      scheduledTime: new Date(slot.start).toISOString(),
      location: slot.location ?? "",
      field: slot.field ?? (slot.location ?? ""),
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

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-accent">Gestione slot orari globali</h2>

      {isOrganizer && (
        <div className="bg-tertiary rounded-xl p-4 mb-6 shadow-lg w-full max-w-md">
          <h4 className="mb-3 font-bold text-accent text-lg">Aggiungi un nuovo slot</h4>
          <div className="flex flex-col gap-3">
            <label className="font-bold text-white">Data e Ora (ISO):</label>
            <input
              type="datetime-local"
              value={slotInput.start}
              onChange={e => setSlotInput(s => ({ ...s, start: e.target.value }))}
              className="border px-3 py-2 rounded font-bold text-white bg-primary"
              placeholder="2025-11-04T17:00"
            />
            <label className="font-bold text-white">Campo / Luogo:</label>
            <input
              type="text"
              value={slotInput.location}
              onChange={e => setSlotInput(s => ({ ...s, location: e.target.value }))}
              className="border px-3 py-2 rounded font-bold text-white bg-primary"
              placeholder="Campo 1"
            />
            <label className="font-bold text-white">Nome Campo (opzionale):</label>
            <input
              type="text"
              value={slotInput.field}
              onChange={e => setSlotInput(s => ({ ...s, field: e.target.value }))}
              className="border px-3 py-2 rounded font-bold text-white bg-primary"
              placeholder="Erba sintetica"
            />
            {slotError && <div className="text-red-400 font-bold text-center">{slotError}</div>}
            <button
              className="bg-highlight text-white px-4 py-2 rounded font-bold mt-2"
              onClick={handleAddSlot}
            >
              Aggiungi Slot
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-lg font-bold mb-3 text-accent">Slot attivi:</h3>
        {(event.globalTimeSlots ?? []).length === 0 && (
          <div className="text-text-secondary">Nessuno slot creato.</div>
        )}
        <ul className="space-y-4">
          {(event.globalTimeSlots ?? []).map(slot => (
            <li key={slot.id} className="bg-tertiary rounded-lg px-4 py-3 flex items-center justify-between shadow-md">
              <div className="flex flex-col">
                <span className="font-bold text-white">
                  {slot.location || slot.field}
                </span>
                <span className="text-sm text-text-secondary">
                  {slot.start
                    ? new Date(slot.start).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) +
                      " " +
                      new Date(slot.start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                    : "Data/ora non valida"
                  }
                </span>
                {slot.field && <span className="text-xs text-text-secondary">Campo: {slot.field}</span>}
              </div>
              <div className="flex items-center gap-2">
                {!isOrganizer && loggedInPlayerId && myPendingMatches.length > 0 && (
                  <button
                    className="bg-highlight text-white px-4 py-2 rounded font-bold"
                    onClick={() => { setModalSlotId(slot.id); setModalBookError(""); }}
                  >
                    Prenota
                  </button>
                )}
                {isOrganizer && (
                  <button
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded ml-2 font-bold"
                    onClick={() => handleDeleteSlot(slot.id)}
                  >
                    Elimina
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Modal prenota da slot */}
      {modalSlotId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
            <h4 className="mb-4 font-bold text-lg text-accent">Prenota una delle tue partite</h4>
            <div className="flex flex-col gap-4">
              <label className="font-bold text-white">Seleziona la partita "pending" da prenotare su questo slot:</label>
              <select
                value={modalMatchId}
                onChange={e => { setModalMatchId(e.target.value); setModalBookError(""); }}
                className="border px-3 py-2 rounded font-bold text-white bg-primary"
              >
                <option value="">Seleziona una partita</option>
                {myPendingMatches.map(match => {
                  const g = tournament.groups.find(gr => gr.matches.some(m => m.id === match.id));
                  const p1 = event.players.find(p => p.id === match.player1Id);
                  const p2 = event.players.find(p => p.id === match.player2Id);
                  return (
                    <option key={match.id} value={match.id}>
                      {p1?.name} vs {p2?.name} {g ? `(${g.name})` : ""}
                    </option>
                  );
                })}
              </select>
              {modalBookError && <div className="text-red-500 font-bold text-center">{modalBookError}</div>}
              <div className="flex gap-2 justify-end pt-3">
                <button
                  onClick={() => { setModalSlotId(null); setModalMatchId(""); setModalBookError(""); }}
                  className="bg-tertiary px-4 py-2 rounded"
                >
                  Annulla
                </button>
                <button
                  disabled={!modalMatchId}
                  onClick={handleBookPendingMatchOnSlot}
                  className="bg-highlight text-white px-4 py-2 rounded font-bold"
                >
                  Prenota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TimeSlots;