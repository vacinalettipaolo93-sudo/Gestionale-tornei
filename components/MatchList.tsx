import React, { useState } from 'react';
import { type Group, type Match, type Player } from '../types';

interface MatchListProps {
  group?: Group | null;
  players?: Player[];
  onEditResult: (match: Match) => void;
  onBookMatch: (match: Match) => void;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (player: Player) => void;
  onRescheduleMatch?: (match: Match) => void;
  onCancelBooking?: (match: Match) => void;
  onDeleteResult?: (match: Match) => void;
  viewingOwnGroup?: boolean;
}

const MatchCard: React.FC<{
  match: Match;
  player1?: Player | null;
  player2?: Player | null;
  onEditResult: (match: Match) => void;
  onBookMatch: (match: Match) => void;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (player: Player) => void;
  onRescheduleMatch?: (match: Match) => void;
  onCancelBooking?: (match: Match) => void;
  onDeleteResult?: (match: Match) => void;
  viewingOwnGroup?: boolean;
}> = ({
  match,
  player1,
  player2,
  onEditResult,
  onBookMatch,
  isOrganizer,
  loggedInPlayerId,
  onPlayerContact,
  onRescheduleMatch,
  onCancelBooking,
  onDeleteResult,
  viewingOwnGroup = false
}) => {
  if (!player1 || !player2) {
    return (
      <div className="bg-secondary p-4 rounded-lg shadow">
        <div className="text-text-secondary">Giocatori non disponibili per questa partita.</div>
      </div>
    );
  }

  const isParticipant = !!(loggedInPlayerId && (loggedInPlayerId === player1.id || loggedInPlayerId === player2.id));
  const canManageBooking = isOrganizer || (isParticipant && viewingOwnGroup);
  const canEnterResult = isOrganizer || (isParticipant && viewingOwnGroup);
  const canBook = isOrganizer || (isParticipant && viewingOwnGroup);
  const canDeleteResult = isOrganizer || (isParticipant && viewingOwnGroup);

  const scheduledInfo = match.status === 'scheduled' && match.scheduledTime
    ? {
        date: new Date(match.scheduledTime).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        time: new Date(match.scheduledTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        field: match.field || match.location || ""
      }
    : null;

  return (
    <div className="bg-secondary p-4 rounded-lg shadow">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Player 1 - SINISTRA */}
        <div className="flex items-center gap-3 justify-start">
          <img src={player1.avatar} alt={player1.name} className="w-10 h-10 rounded-full object-cover" />
          <button onClick={() => onPlayerContact(player1)} className="text-left font-semibold hover:underline text-text-primary cursor-pointer">
            {player1.name}
          </button>
        </div>

        {/* Score centrale */}
        <div className="flex flex-col items-center">
          {match.score1 != null && match.score2 != null ? (
            <div className="text-2xl font-bold text-center">
              {match.score1} — {match.score2}
            </div>
          ) : (
            <div className="text-lg font-medium text-center text-text-secondary">vs</div>
          )}
          {scheduledInfo && (
            <div className="text-sm text-text-secondary mt-2 text-center">
              <span>
                {scheduledInfo.date} — {scheduledInfo.time}
              </span>
              {scheduledInfo.field && (
                <div className="font-bold text-white">
                  {scheduledInfo.field}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Player 2 - DESTRA */}
        <div className="flex items-center gap-3 justify-end">
          <button onClick={() => onPlayerContact(player2)} className="font-semibold hover:underline text-text-primary cursor-pointer">
            {player2.name}
          </button>
          <img src={player2.avatar} alt={player2.name} className="w-10 h-10 rounded-full object-cover" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 pt-4 mt-4 border-t border-tertiary/50">
        {match.status === 'pending' && canBook && (
          <button onClick={() => onBookMatch(match)} className="bg-accent/80 hover:bg-accent text-primary font-bold py-2 px-3 rounded-lg text-sm transition-colors">
            Prenota
          </button>
        )}
        {canEnterResult && (
          <button onClick={() => onEditResult(match)} className="bg-highlight/80 hover:bg-highlight text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
            Risultato
          </button>
        )}
        {match.status === 'scheduled' && canManageBooking && onRescheduleMatch && (
          <button onClick={() => onRescheduleMatch(match)} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
            Modifica pren.
          </button>
        )}
        {match.status === 'scheduled' && canManageBooking && onCancelBooking && (
          <button onClick={() => onCancelBooking(match)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
            Annulla pren.
          </button>
        )}
        {match.score1 != null && match.score2 != null && canDeleteResult && onDeleteResult && (
          <button onClick={() => onDeleteResult(match)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
            Elimina risultato
          </button>
        )}
      </div>
    </div>
  );
};

const MatchList: React.FC<MatchListProps> = ({
  group = null,
  players = [],
  onEditResult,
  onBookMatch,
  isOrganizer,
  loggedInPlayerId,
  onPlayerContact,
  onRescheduleMatch,
  onCancelBooking,
  onDeleteResult,
  viewingOwnGroup = false
}) => {
  const [filter, setFilter] = useState<'all' | 'my'>(isOrganizer ? 'all' : 'my');

  if (!group) {
    return <p className="text-center text-text-secondary py-6">Seleziona un girone per vedere le partite.</p>;
  }

  const getPlayer = (playerId?: string) => players.find(p => p.id === playerId);

  const filteredMatches = (status: Match['status']) => {
    return group.matches.filter(m => {
      const isMyMatch = !!(loggedInPlayerId && (m.player1Id === loggedInPlayerId || m.player2Id === loggedInPlayerId));
      return m.status === status && (filter === 'all' || isMyMatch);
    });
  };

  const pendingMatches = filteredMatches('pending');
  
  // --- FILTRI MIGLIORATI: "partite programmate" mostra solo se slotId + scheduledTime è valorizzato ---
  const scheduledMatches = group.matches.filter(m =>
    m.status === 'scheduled' &&
    m.slotId &&
    m.scheduledTime &&
    (filter === 'all' || (!!loggedInPlayerId && (m.player1Id === loggedInPlayerId || m.player2Id === loggedInPlayerId)))
  );
  
  const completedMatches = group.matches.filter(m => m.score1 != null && m.score2 != null);

  // Optional: ordina le liste per scheduledTime quando disponibile (stabile)
  const sortByTime = (arr: Match[]) =>
    arr.slice().sort((a, b) => {
      const ta = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
      const tb = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;
      return ta - tb;
    });

  return (
    <div className="space-y-6">
      {!isOrganizer && (
        <div className="flex justify-center mb-4">
          <div className="bg-tertiary/50 rounded-lg p-1 flex">
            <button
              onClick={() => setFilter('my')}
              className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${filter === 'my' ? 'bg-highlight text-white' : 'text-text-secondary'}`}
            >
              Le mie
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${filter === 'all' ? 'bg-highlight text-white' : 'text-text-secondary'}`}
            >
              Tutte
            </button>
          </div>
        </div>
      )}

      {/* ORDINE RICHIESTO: 1) Programmate, 2) Da Fare, 3) Completate */}

      <div>
        <h4 className="text-lg font-semibold mb-3 text-accent">Partite Programmate</h4>
        <div className="space-y-3">
          {scheduledMatches.length > 0 ? sortByTime(scheduledMatches).map(match => (
            <MatchCard
              key={match.id}
              match={match}
              player1={getPlayer(match.player1Id)}
              player2={getPlayer(match.player2Id)}
              onEditResult={onEditResult}
              onBookMatch={onBookMatch}
              isOrganizer={isOrganizer}
              loggedInPlayerId={loggedInPlayerId}
              onPlayerContact={onPlayerContact}
              onRescheduleMatch={onRescheduleMatch}
              onCancelBooking={onCancelBooking}
              onDeleteResult={onDeleteResult}
              viewingOwnGroup={viewingOwnGroup}
            />
          )) : <p className="text-text-secondary text-center py-4">Nessuna partita programmata.</p>}
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-3 text-accent">Partite da Fare</h4>
        <div className="space-y-3">
          {pendingMatches.length > 0 ? pendingMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              player1={getPlayer(match.player1Id)}
              player2={getPlayer(match.player2Id)}
              onEditResult={onEditResult}
              onBookMatch={onBookMatch}
              isOrganizer={isOrganizer}
              loggedInPlayerId={loggedInPlayerId}
              onPlayerContact={onPlayerContact}
              onRescheduleMatch={onRescheduleMatch}
              onCancelBooking={onCancelBooking}
              onDeleteResult={onDeleteResult}
              viewingOwnGroup={viewingOwnGroup}
            />
          )) : <p className="text-text-secondary text-center py-4">Nessuna partita da disputare.</p>}
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-3 text-accent">Partite Completate</h4>
        <div className="space-y-3">
          {completedMatches.length > 0 ? completedMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              player1={getPlayer(match.player1Id)}
              player2={getPlayer(match.player2Id)}
              onEditResult={onEditResult}
              onBookMatch={onBookMatch}
              isOrganizer={isOrganizer}
              loggedInPlayerId={loggedInPlayerId}
              onPlayerContact={onPlayerContact}
              onRescheduleMatch={onRescheduleMatch}
              onCancelBooking={onCancelBooking}
              onDeleteResult={onDeleteResult}
              viewingOwnGroup={viewingOwnGroup}
            />
          )) : <p className="text-text-secondary text-center py-4">Nessuna partita completata.</p>}
        </div>
      </div>
    </div>
  );
};

export default MatchList;
