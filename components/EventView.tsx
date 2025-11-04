import React, { useState } from "react";
import { type Event, type Tournament } from "../types";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import TimeSlots from "./TimeSlots";

// --------- AGGIUNTA COMPONENTE RegolamentoGironiPanel ----------
const RegolamentoGironiPanel: React.FC<{
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}> = ({ event, tournament, setEvents }) => {
  const [selectedGroupId, setSelectedGroupId] = useState(tournament.groups[0]?.id ?? "");
  const selectedGroup = tournament.groups.find((g) => g.id === selectedGroupId);
  const [rulesText, setRulesText] = useState<string>(selectedGroup?.rules ?? "");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  React.useEffect(() => {
    setRulesText(selectedGroup?.rules ?? "");
    setSuccessMsg("");
  }, [selectedGroupId, tournament.groups]);

  const handleChangeGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    const group = tournament.groups.find((g) => g.id === groupId);
    setRulesText(group?.rules ?? "");
  };

  const handleSaveRules = async () => {
    if (!selectedGroup) return;

    setLoading(true);
    setSuccessMsg("");
    const updatedGroups = tournament.groups.map((g) =>
      g.id === selectedGroup.id ? { ...g, rules: rulesText } : g
    );

    setEvents((prevEvents) =>
      prevEvents.map((e) => {
        if (e.id !== event.id) return e;
        return {
          ...e,
          tournaments: e.tournaments.map((t) =>
            t.id === tournament.id ? { ...t, groups: updatedGroups } : t
          ),
        };
      })
    );

    await updateDoc(doc(db, "events", event.id), {
      tournaments: event.tournaments.map((t) =>
        t.id === tournament.id ? { ...t, groups: updatedGroups } : t
      ),
    });

    setLoading(false);
    setSuccessMsg("Regolamento salvato per il girone!");
  };

  if (!selectedGroup) return null;
  return (
    <div className="mb-8 bg-secondary p-6 rounded-xl shadow-md">
      <h3 className="text-xl mb-4 font-bold text-accent">Regolamento di ogni Girone</h3>
      <div className="flex items-center gap-4 mb-4">
        <label className="font-semibold">Scegli Girone:</label>
        <select
          value={selectedGroupId}
          onChange={(e) => handleChangeGroup(e.target.value)}
          className="bg-tertiary rounded px-3 py-2 font-bold"
        >
          {tournament.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={rulesText}
        onChange={(e) => setRulesText(e.target.value)}
        className="w-full rounded bg-primary border p-3 min-h-[120px] mb-3"
        placeholder="Scrivi qui il regolamento per il girone selezionato..."
        disabled={loading}
      />
      <button
        onClick={handleSaveRules}
        disabled={loading}
        className="bg-highlight text-white px-4 py-2 rounded font-bold"
      >
        {loading ? "Salvando..." : "Salva regolamento per girone"}
      </button>
      {successMsg && <div className="text-green-600 mt-3 font-semibold">{successMsg}</div>}
    </div>
  );
};
// -------------------------------------------------------------------------

interface EventViewProps {
  event: Event;
  onSelectTournament: (tournament: Tournament) => void;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
}

const EventView: React.FC<EventViewProps> = ({
  event,
  onSelectTournament,
  setEvents,
  isOrganizer,
  loggedInPlayerId,
}) => {
  const [rulesDraft, setRulesDraft] = useState(event.rules ?? "");
  const [rulesEdit, setRulesEdit] = useState(false);

  const handleSaveRules = async () => {
    setEvents(prev =>
      prev.map(ev => ev.id === event.id ? { ...ev, rules: rulesDraft } : ev)
    );
    await updateDoc(doc(db, "events", event.id), { rules: rulesDraft });
    setRulesEdit(false);
  };

  const handleDeleteRules = async () => {
    setEvents(prev =>
      prev.map(ev => ev.id === event.id ? { ...ev, rules: "" } : ev)
    );
    await updateDoc(doc(db, "events", event.id), { rules: "" });
    setRulesDraft("");
    setRulesEdit(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* HEADER EVENTO */}
      <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{event.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="bg-primary px-3 py-1 rounded-lg text-sm text-text-secondary">
              Codice Invito: <span className="font-bold text-accent">{event.invitationCode}</span>
            </span>
          </div>
        </div>
        {isOrganizer && (
          <button className="bg-accent px-5 py-2 rounded-lg text-white font-bold hover:bg-accent/80 shadow transition-all">
            + Aggiungi Torneo
          </button>
        )}
      </div>

      {/* CARD TORNEI */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Tornei</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {event.tournaments.map(tournament => (
            <div key={tournament.id} className="bg-secondary rounded-xl shadow-lg p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-accent mb-2">{tournament.name}</h3>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-text-secondary">
                    {tournament.groups.length} gironi
                  </span>
                </div>
                <div className="text-sm text-text-secondary mb-2">
                  Progresso
                </div>
                <div className="w-full bg-tertiary/30 h-2 rounded-full mb-2">
                  <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: `0%` }}></div>
                </div>
                <div className="text-xs text-text-secondary mb-2">
                  0 / {tournament.matches?.length ?? 0} partite
                </div>
                <div className="text-xs text-text-secondary mb-2">
                  0% Completato
                </div>
              </div>
              <button
                onClick={() => onSelectTournament(tournament)}
                className="bg-accent text-white py-2 px-4 rounded-lg font-bold mt-4"
              >
                Visualizza Torneo
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SLOT ORARI GLOBALI (solo organizzatore) */}
      {isOrganizer && event.globalTimeSlots && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-white">Slot Orari Globali</h2>
          <TimeSlots
            event={event}
            tournament={undefined}
            setEvents={setEvents}
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
            selectedGroupId={undefined}
            globalTimeSlots={event.globalTimeSlots}
          />
        </div>
      )}

      {/* REGOLAMENTO (solo organizzatore) */}
      {isOrganizer && (
        <div className="bg-tertiary p-6 rounded-xl shadow-lg mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-bold text-accent">Regolamento Torneo</h3>
            {!rulesEdit && (
              <button
                onClick={() => setRulesEdit(true)}
                className="py-1 px-4 bg-highlight text-white rounded-lg font-semibold"
              >
                Modifica
              </button>
            )}
          </div>
          {rulesEdit ? (
            <div>
              <textarea
                value={rulesDraft}
                onChange={e => setRulesDraft(e.target.value)}
                rows={6}
                className="w-full p-2 bg-primary border border-tertiary rounded-lg text-text-primary"
                placeholder="Scrivi qui le regole del torneo..."
              />
              <div className="flex gap-3 justify-end mt-2">
                <button
                  onClick={handleSaveRules}
                  className="py-1 px-4 bg-accent text-white rounded-lg font-semibold"
                >
                  Salva
                </button>
                <button
                  onClick={() => setRulesEdit(false)}
                  className="py-1 px-4 bg-tertiary text-text-primary rounded-lg font-semibold"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteRules}
                  className="py-1 px-4 bg-red-600 text-white rounded-lg font-semibold"
                >
                  Cancella
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-primary p-4 rounded-lg border border-tertiary mt-2 whitespace-pre-line">
              {event.rules?.trim() ? event.rules : <span className="text-text-secondary">Nessun regolamento inserito.</span>}
            </div>
          )}
        </div>
      )}

      {/* REGOLAMENTO PER OGNI GIRONE - SOLO ORGANIZZATORE */}
      {isOrganizer && event.tournaments.length > 0 &&
        event.tournaments.map(tournament => (
          <RegolamentoGironiPanel
            key={tournament.id}
            event={event}
            tournament={tournament}
            setEvents={setEvents}
          />
        ))
      }
    </div>
  );
};

export default EventView;
