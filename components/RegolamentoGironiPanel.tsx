import React, { useState, useEffect } from "react";
import { type Event, type Tournament, type Group } from "../types";
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface RegolamentoGironiPanelProps {
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}

const RegolamentoGironiPanel: React.FC<RegolamentoGironiPanelProps> = ({
  event,
  tournament,
  setEvents,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState(tournament.groups[0]?.id ?? "");
  const selectedGroup = tournament.groups.find((g) => g.id === selectedGroupId);
  const [rulesText, setRulesText] = useState<string>(selectedGroup?.rules ?? "");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
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
      <h3 className="text-xl mb-4 font-bold text-accent">Regolamenti Gironi</h3>
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

export default RegolamentoGironiPanel;
