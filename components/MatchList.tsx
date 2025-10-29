import React, { useState } from 'react';
import { type Group, type Match, type Player } from '../types';
import { WhatsAppIcon } from './Icons';

interface MatchListProps {
  group: Group;
  players: Player[];
  onEditResult: (match: Match) => void;
  onBookMatch: (match: Match) => void;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (player: Player) => void;
  onRescheduleMatch?: (match: Match) => void;
  onCancelBooking?: (match: Match) => void;
  onDeleteResult?: (match: Match) => void;
}

const MatchCard: React.FC<{
  match: Match;
  player1?: Player;
  player2?: Player;
  onEditResult: (match: Match) => void;
  onBookMatch: (match: Match) => void;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (player: Player) => void;
  onRescheduleMatch?: (match: Match) => void;
  onCancelBooking?: (match: Match) => void;
  onDeleteResult?: (match: Match) => void;
}> = ({
  match, player1, player2, onEditResult, onBookMatch, isOrganizer, loggedInPlayerId, onPlayerContact, onRescheduleMatch, onCancelBooking, onDeleteResult
}) => {
  if (!player1 || !player2) return null;

  const isParticipant = loggedInPlayerId === player1.id || loggedInPlayerId === player2.id;
  const opponent = loggedInPlayerId === player1.id ? player2 : player1;

  // allow organizer or one of the two players to manage the booking
  const canManageBooking = isOrganizer || isParticipant;
  const canEnterResult = isParticipant || isOrganizer;
  const canBook = isParticipant || isOrganizer;
  const canDeleteResult = isParticipant || isOrganizer;

  const handleEnterResult = () => onEditResult(match);

  const renderResult = () => {
    if (match.score1 != null && match.score2 != null) {
      return (
        <div className="text-2xl font-bold text-center w-full">
          {match.score1} — {match.score2}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-secondary p-4 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={player1.avatar} alt={player1.name} className="w-10 h-10 rounded-full object-cover" />
          <div>
            <div className="font-semibold">{player1.name}</div>
            <div className="text-sm text-text-secondary">{player2.name}</div>
          </div>
        </div>

        <div className="text-right">
          {!(match.score1 != null && match.score2 != null) && match.status === 'scheduled' && match.scheduledTime ? (
            <>
              <div>{new Date(match.scheduledTime).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} alle {new Date(match.scheduledTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
              {match.location && <div className="font-semibold">{match.location}</div>}
            </>
          ) : !(match.score1 != null && match.score2 != null) ? (
            <div className="text-lg font-mono text-text-secondary">vs</div>
          ) : null}
        </div>
      </div>

      {renderResult()}

      <div className="flex items-center justify-center gap-4 pt-4 mt-4 border-t border-tertiary/50">
        {match.status === 'pending' && canBook && (
            <button onClick={() => onBookMatch(match)} className="bg-accent/80 hover:bg-accent text-primary font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                Prenota
            </button>
        )}

        {canEnterResult && (
          <button onClick={handleEnterResult} className="bg-highlight/80 hover:bg-highlight text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
            Risultato
          </button>
        )}

        {/* Modifica / Annulla pren. disponibili per organizer e per i due giocatori coinvolti */}
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

        {!isOrganizer && isParticipant && (
            <button onClick={() => onPlayerContact(opponent)} className="text-green-400 hover:text-green-300 transition-colors" title={`Contatta ${opponent.name} su WhatsApp`}>
                <WhatsAppIcon />
            </button>
        )}
      </div>
    </div>
  );
};

const MatchList: React.FC<MatchListProps> = ({
  group,
  players,
  onEditResult,
  onBookMatch,
  isOrganizer,
  loggedInPlayerId,
  onPlayerContact,
  onRescheduleMatch,
  onCancelBooking,
  onDeleteResult,
}) => {
  const [filter, setFilter] = useState<'all' | 'my'>(isOrganizer ? 'all' : 'my');

  const getPlayer = (playerId: string) => players.find(p => p.id === playerId);

  const filteredMatches = (status: Match['status']) => {
    return group.matches.filter(m => {
        const isMyMatch = loggedInPlayerId && (m.player1Id === loggedInPlayerId || m.player2Id === loggedInPlayerId);
        return m.status === status && (filter === 'all' || isMyMatch);
    })
  };

  const pendingMatches = filteredMatches('pending');
  const scheduledMatches = filteredMatches('scheduled');
  const completedMatches = group.matches.filter(m => m.score1 != null && m.score2 != null);

  return (
    <div className="space-y-6">
        {!isOrganizer && (
            <div className="flex justify-center mb-4">
                <div className="bg-tertiary/50 rounded-lg p-1">
                    <button onClick={() => setFilter('my')} className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${filter === 'my' ? 'bg-highlight text-white' : 'text-text-secondary'}`}>Le mie partite</button>
                    <button onClick={() => setFilter('all')} className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${filter === 'all' ? 'bg-highlight text-white' : 'text-text-secondary'}`}>Tutte le partite</button>
                </div>
            </div>
        )}

        <div>
            <h4 className="text-lg font-semibold mb-3 text-accent">Partite da Fare</h4>
            <div className="space-y-3">
                {pendingMatches.length > 0 ? pendingMatches.map(match => (
                    <MatchCard key={match.id} match={match} player1={getPlayer(match.player1Id)} player2={getPlayer(match.player2Id)} onEditResult={onEditResult} onBookMatch={onBookMatch} isOrganizer={isOrganizer} loggedInPlayerId={loggedInPlayerId} onPlayerContact={onPlayerContact} onRescheduleMatch={onRescheduleMatch} onCancelBooking={onCancelBooking} onDeleteResult={onDeleteResult} />
                )) : <p className="text-text-secondary text-center py-4">Nessuna partita da disputare.</p>}
            </div>
        </div>

        <div>
            <h4 className="text-lg font-semibold mb-3 text-accent">Partite Programmate</h4>
            <div className="space-y-3">
                {scheduledMatches.length > 0 ? scheduledMatches.map(match => (
                    <MatchCard key={match.id} match={match} player1={getPlayer(match.player1Id)} player2={getPlayer(match.player2Id)} onEditResult={onEditResult} onBookMatch={onBookMatch} isOrganizer={isOrganizer} loggedInPlayerId={loggedInPlayerId} onPlayerContact={onPlayerContact} onRescheduleMatch={onRescheduleMatch} onCancelBooking={onCancelBooking} onDeleteResult={onDeleteResult} />
                )) : <p className="text-text-secondary text-center py-4">Nessuna partita programmata.</p>}
            </div>
        </div>

        <div>
            <h4 className="text-lg font-semibold mb-3 text-accent">Partite Completate</h4>
            <div className="space-y-3">
                {completedMatches.length > 0 ? completedMatches.map(match => (
                    <MatchCard key={match.id} match={match} player1={getPlayer(match.player1Id)} player2={getPlayer(match.player2Id)} onEditResult={onEditResult} onBookMatch={onBookMatch} isOrganizer={isOrganizer} loggedInPlayerId={loggedInPlayerId} onPlayerContact={onPlayerContact} onRescheduleMatch={onRescheduleMatch} onCancelBooking={onCancelBooking} onDeleteResult={onDeleteResult} />
                )) : <p className="text-text-secondary text-center py-4">Nessuna partita completata.</p>}
            </div>
        </div>
    </div>
  );
};

export default MatchList;
