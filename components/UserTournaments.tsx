import React from 'react';
import { type Event, type Tournament } from '../types';

interface Props {
  events: Event[];
  loggedInPlayerId?: string;
  onOpenTournament: (event: Event, tournament: Tournament, selectedGroupId?: string) => void;
}

const UserTournaments: React.FC<Props> = ({ events, loggedInPlayerId, onOpenTournament }) => {
  if (!loggedInPlayerId) return <p className="text-text-secondary">Effettua il login per vedere i tuoi tornei.</p>;

  const myTournaments: { event: Event; tournament: Tournament; myGroupId?: string }[] = [];

  for (const ev of events) {
    for (const t of ev.tournaments) {
      const myGroup = Array.isArray(t.groups)
        ? t.groups.find(g => Array.isArray(g.playerIds) && g.playerIds.includes(loggedInPlayerId))
        : undefined;
      if (myGroup) {
        myTournaments.push({ event: ev, tournament: t, myGroupId: myGroup.id });
      }
    }
  }

  if (myTournaments.length === 0) {
    return <p className="text-text-secondary">Non sei iscritto a nessun torneo.</p>;
  }

  return (
    <div className="space-y-3">
      {myTournaments.map(({ event, tournament, myGroupId }) => (
        <div key={`${event.id}-${tournament.id}`} className="bg-secondary p-3 rounded-lg flex items-center justify-between">
          <div>
            <div className="font-semibold">
              {tournament.name} <span className="text-sm text-text-secondary">({event.name})</span>
              {myGroupId && <span className="ml-3 inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded">Tuo torneo</span>}
            </div>
            {myGroupId ? <div className="text-sm text-text-secondary">Il tuo girone: <strong>{Array.isArray(tournament.groups) ? tournament.groups.find(g => g.id === myGroupId)?.name ?? '-' : '-'}</strong></div> : null}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onOpenTournament(event, tournament, myGroupId)} className="bg-highlight text-white py-1 px-3 rounded">Entra</button>
            <button onClick={() => onOpenTournament(event, tournament, undefined)} className="bg-tertiary text-text-primary py-1 px-3 rounded">Vedi tutti (risultati)</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserTournaments;
