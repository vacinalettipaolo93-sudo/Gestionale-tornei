import React from 'react';
import { type Event } from '../types';
import { calculateStandings } from '../utils/standings';

interface ParticipantDashboardProps {
  events: Event[];
  playerId: string;
  onSelectEvent: (event: Event) => void;
}

const ParticipantDashboard: React.FC<ParticipantDashboardProps> = ({ events, playerId, onSelectEvent }) => {
  const myEvents = events.filter(event => 
    event.players.some(p => p.id === playerId && p.status === 'confirmed')
  );

  const getPlayerStats = (event: Event) => {
    let position = 'N/A';
    let played = 0;
    let toPlay = 0;
    let totalMatches = 0;
    let completionPercentage = 0;
    let tournamentName = '';

    const tournament = event.tournaments.find(t => 
      t.groups.some(g => g.playerIds.includes(playerId))
    );
    if (tournament) {
      tournamentName = tournament.name;
      const group = tournament.groups.find(g => g.playerIds.includes(playerId));
      if (group) {
        const standings = calculateStandings(group, event.players, tournament.settings);
        const myStanding = standings.findIndex(s => s.playerId === playerId);
        if (myStanding !== -1) {
          position = `${myStanding + 1}°`;
        }
        
        const myMatches = group.matches.filter(m => m.player1Id === playerId || m.player2Id === playerId);
        totalMatches = myMatches.length;
        played = myMatches.filter(m => m.status === 'completed').length;
        toPlay = totalMatches - played;
        completionPercentage = totalMatches > 0 ? Math.round((played / totalMatches) * 100) : 0;
      }
    }
    return { position, played, toPlay, totalMatches, completionPercentage, tournamentName };
  };

  return (
    <div className="space-y-6 animate-fadeIn">
        <h2 className="text-3xl font-bold">I Miei Eventi</h2>
        {myEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myEvents.map(event => {
                    const stats = getPlayerStats(event);
                    return (
                        <div 
                            key={event.id}
                            onClick={() => onSelectEvent(event)} 
                            className="bg-secondary rounded-xl shadow-lg transition-all duration-300 group relative overflow-hidden flex flex-col cursor-pointer"
                        >
                             <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="p-6 flex-grow z-10">
                                <h3 className="text-xl font-bold text-accent truncate">{event.name}</h3>
                                <p className="text-text-secondary mt-1 text-sm">{stats.tournamentName}</p>
                                <div className="mt-4 pt-4 border-t border-tertiary/50 grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold">{stats.position}</div>
                                        <div className="text-xs text-text-secondary">Classifica</div>
                                    </div>
                                     <div>
                                        <div className="text-2xl font-bold">{stats.played}</div>
                                        <div className="text-xs text-text-secondary">Giocate</div>
                                    </div>
                                     <div>
                                        <div className="text-2xl font-bold">{stats.toPlay}</div>
                                        <div className="text-xs text-text-secondary">Mancanti</div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-tertiary/50">
                                    <div className="flex justify-between items-center text-sm mb-1">
                                        <span className="text-text-secondary">Mio Progresso</span>
                                        <span className="font-semibold text-text-primary">{stats.played} / {stats.totalMatches} partite</span>
                                    </div>
                                    <div className="w-full bg-tertiary/50 rounded-full h-2.5">
                                        <div className="bg-gradient-to-r from-accent to-highlight h-2.5 rounded-full transition-all duration-500" style={{ width: `${stats.completionPercentage}%` }}></div>
                                    </div>
                                    <div className="text-right text-xs text-text-secondary mt-1">{stats.completionPercentage}% Completato</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="text-center py-10 bg-secondary rounded-xl">
                <p className="text-text-secondary">Non sei ancora iscritto a nessun evento.</p>
            </div>
        )}
    </div>
  );
};

export default ParticipantDashboard;