import React from 'react';
import { type Group, type Player } from '../types';

interface Props {
  group?: Group;
  players: Player[];
  onPlayerContact?: (p: Player) => void;
}

const GroupPlayers: React.FC<Props> = ({ group, players, onPlayerContact }) => {
  const groupPlayers = Array.isArray(group?.playerIds)
    ? group.playerIds.map(pid => players.find(p => p.id === pid)).filter(Boolean) as Player[]
    : [];

  if (groupPlayers.length === 0) {
    return <p className="text-text-secondary">Nessun giocatore nel girone.</p>;
  }

  return (
    <div className="bg-secondary p-4 rounded-lg">
      <h4 className="text-lg font-semibold mb-3">Giocatori del girone: {group?.name ?? '-'}</h4>
      <ul className="space-y-2">
        {groupPlayers.map(p => (
          <li key={p.id} className="flex items-center justify-between p-2 rounded-md hover:bg-tertiary/40">
            <div className="flex items-center gap-3">
              <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
              <button
                onClick={() => onPlayerContact?.(p)}
                className="text-left font-medium hover:underline text-text-primary"
                aria-label={`Contatta ${p.name}`}
              >
                {p.name}
              </button>
            </div>
            <div className="text-sm text-text-secondary">
              {p.rank ? `#${p.rank}` : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GroupPlayers;
