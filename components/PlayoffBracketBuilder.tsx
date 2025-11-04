import React, { useState } from "react";
import { type Player, type Group } from "../types";

// Props: players da assegnare, numero match/tabellone, callback
const PlayoffBracketBuilder: React.FC<{
  assignedPlayers: Player[];
  matchCount: number;
  onAssign: (assignments: { [matchId: string]: [string | null, string | null] }) => void;
}> = ({ assignedPlayers, matchCount, onAssign }) => {
  const [assignments, setAssignments] = useState<{ [m: string]: [string | null, string | null] }>({});

  // Genera la tabella dei match
  const tableRows = [];
  for (let i = 1; i <= matchCount; i++) {
    const matchId = `M${i}`;
    tableRows.push(
      <div key={matchId} className="flex gap-3 mb-3">
        <select
          className="bg-primary rounded px-2 py-1 grow"
          value={assignments[matchId]?.[0] || ""}
          onChange={e => setAssignments(a => ({ ...a, [matchId]: [e.target.value, a[matchId]?.[1] || null] }))}
        >
          <option value="">-- Seleziona --</option>
          {assignedPlayers.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span className="font-bold text-white mx-3">vs</span>
        <select
          className="bg-primary rounded px-2 py-1 grow"
          value={assignments[matchId]?.[1] || ""}
          onChange={e => setAssignments(a => ({ ...a, [matchId]: [a[matchId]?.[0] || null, e.target.value] }))}
        >
          <option value="">-- Seleziona --</option>
          {assignedPlayers.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    );
  }

  // Giocatori non ancora assegnati
  const assignedIds = Object.values(assignments)
    .flat()
    .filter(Boolean);
  const toAssign = assignedPlayers.filter(p => !assignedIds.includes(p.id));

  return (
    <div className="flex flex-wrap gap-8">
      {/* Tabella builder */}
      <div className="flex-grow">
        <h3 className="text-xl font-bold mb-2 text-accent">Costruttore Tabellone Playoff</h3>
        <div className="text-text-secondary mb-4">Assegna manualmente i giocatori agli incontri del primo turno playoff.</div>
        {tableRows}
        <button
          className="bg-highlight text-white px-4 py-2 mt-4 rounded font-bold"
          onClick={() => onAssign(assignments)}
        >
          Genera Tabellone
        </button>
      </div>
      {/* Riepilogo */}
      <div className="min-w-[240px]">
        <h4 className="text-lg font-bold mb-3">Riepilogo</h4>
        <div className="mb-3">
          <span className="block text-sm text-text-secondary">Qualificati: <span className="font-bold">{assignedPlayers.length}</span></span>
          <span className="block text-sm text-text-secondary">Posti: <span className="font-bold">{matchCount * 2}</span></span>
          <span className="block text-sm text-text-secondary">Bye: <span className="font-bold">{(matchCount * 2) - assignedPlayers.length}</span></span>
        </div>
        <h5 className="text-sm font-bold mb-2">Giocatori da Assegnare</h5>
        <ul>
          {toAssign.map(p =>
            <li key={p.id} className="mb-2 flex gap-2 items-center text-white font-semibold">
              <span className="bg-tertiary px-2 py-1 rounded-full">{p.name}</span>
              <span className="text-text-secondary text-xs">{p.id}</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default PlayoffBracketBuilder;
