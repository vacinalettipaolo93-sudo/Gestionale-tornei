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
}> = ({ match, player1, player2, onEditResult, onBookMatch, isOrganizer, loggedInPlayerId, onPlayerContact }) => {
  if (!player1 || !player2) return null;

  const isParticipant = loggedInPlayerId === player1.id || loggedInPlayerId === player2.id;
  const opponent = loggedInPlayerId === player1.id ? player2 : player1;
  const canEnterResult = isParticipant || isOrganizer;
  const canBook = isParticipant || isOrganizer;

  const handleEnterResult = () => {
     if (isOrganizer) {
        onEditResult(match);
     } else if (match.status !== 'completed' && isParticipant) {
        onEditResult(match);
     }
  }

  const PlayerDisplay = ({ player, alignment = 'left' }: { player: Player, alignment?: 'left' | 'right' }) => {
    const isLoggedUser = player.id === loggedInPlayerId;
    return (
        <div className={`flex items-center gap-3 ${alignment === 'right' ? 'flex-row-reverse' : ''}`}>
            <img src={player.avatar} alt={player.name} className="w-10 h-10 rounded-full object-cover" />
            <span className={`font-semibold ${isLoggedUser ? 'text-accent' : ''}`}>{player.name}</span>
        </div>
    )
  }

  return (
    <div className="bg-secondary rounded-xl p-4 shadow-lg transition-all hover:bg-tertiary/50">
      <div className="grid grid-cols-3 items-center gap-2">
        <div className="flex justify-start"><PlayerDisplay player={player1} alignment="left"/></div>
        
        <div className="flex flex-col items-center justify-center gap-1 text-center">
            {match.status === 'completed' ? (
              <div className="text-2xl font-bold bg-primary px-4 py-2 rounded-lg">
                <span>{match.score1}</span>
                <span className="mx-2">-</span>
                <span>{match.score2}</span>
              </div>
            ) : match.status === 'scheduled' && match.scheduledTime ? (
                <div className="text-center text-xs text-accent-hover bg-accent/20 px-2 py-1 rounded">
                    <div>{new Date(match.scheduledTime).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} alle {new Date(match.scheduledTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                    {match.location && <div className="font-semibold">{match.location}</div>}
                </div>
            ) : (
              <div className="text-lg font-mono text-text-secondary">vs</div>
            )}
        </div>

        <div className="flex justify-end"><PlayerDisplay player={player2} alignment="right"/></div>
      </div>
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
         {!isOrganizer && isParticipant && (
            <button onClick={() => onPlayerContact(opponent)} className="text-green-400 hover:text-green-300 transition-colors" title={`Contatta ${opponent.name} su WhatsApp`}>
                <WhatsAppIcon />
            </button>
         )}
      </div>
    </div>
  );
};


const MatchList: React.FC<MatchListProps> = ({ group, players, onEditResult, onBookMatch, isOrganizer, loggedInPlayerId, onPlayerContact }) => {
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
  const completedMatches = filteredMatches('completed');

  return (
    <div className="space-y-6">
        {!isOrganizer && (
            <div className="flex justify-center mb-4">
                <div className="bg-tertiary/50 rounded-lg p-1 flex">
                    <button onClick={() => setFilter('my')} className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${filter === 'my' ? 'bg-highlight text-white' : 'text-text-secondary'}`}>Le mie partite</button>
                    <button onClick={() => setFilter('all')} className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${filter === 'all' ? 'bg-highlight text-white' : 'text-text-secondary'}`}>Tutte le partite</button>
                </div>
            </div>
        )}
        <div>
            <h4 className="text-lg font-semibold mb-3 text-accent">Partite da Fare</h4>
            <div className="space-y-3">
                {pendingMatches.length > 0 ? pendingMatches.map(match => (
                    <MatchCard key={match.id} match={match} player1={getPlayer(match.player1Id)} player2={getPlayer(match.player2Id)} onEditResult={onEditResult} onBookMatch={onBookMatch} isOrganizer={isOrganizer} loggedInPlayerId={loggedInPlayerId} onPlayerContact={onPlayerContact} />
                )) : <p className="text-text-secondary text-center py-4">Nessuna partita da disputare.</p>}
            </div>
        </div>
        <div>
            <h4 className="text-lg font-semibold mb-3 text-accent">Partite Programmate</h4>
            <div className="space-y-3">
                {scheduledMatches.length > 0 ? scheduledMatches.map(match => (
                    <MatchCard key={match.id} match={match} player1={getPlayer(match.player1Id)} player2={getPlayer(match.player2Id)} onEditResult={onEditResult} onBookMatch={onBookMatch} isOrganizer={isOrganizer} loggedInPlayerId={loggedInPlayerId} onPlayerContact={onPlayerContact} />
                )) : <p className="text-text-secondary text-center py-4">Nessuna partita in programma.</p>}
            </div>
        </div>
        <div>
            <h4 className="text-lg font-semibold mb-3 text-accent">Partite Completate</h4>
            <div className="space-y-3">
                {completedMatches.length > 0 ? completedMatches.map(match => (
                    <MatchCard key={match.id} match={match} player1={getPlayer(match.player1Id)} player2={getPlayer(match.player2Id)} onEditResult={onEditResult} onBookMatch={onBookMatch} isOrganizer={isOrganizer} loggedInPlayerId={loggedInPlayerId} onPlayerContact={onPlayerContact} />
                )) : <p className="text-text-secondary text-center py-4">Nessuna partita ancora giocata.</p>}
            </div>
        </div>
    </div>
  );
};

export default MatchList;