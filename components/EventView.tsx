import React, { useState } from 'react';
import { type Event, type Tournament } from '../types';
import { TrophyIcon, UsersIcon, PlusIcon, TrashIcon } from './Icons';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface EventViewProps {
  event: Event;
  onSelectTournament: (tournament: Tournament) => void;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
}

const EventView: React.FC<EventViewProps> = ({ event, onSelectTournament, setEvents, isOrganizer }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);

  // AGGIUNGI TORNEO E AGGIORNA FIRESTORE
  const handleAddTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newTournamentName.trim()) return;

    const newTournament: Tournament = {
        id: `trn${Date.now()}`,
        name: newTournamentName.trim(),
        groups: [],
        settings: { 
            pointsPerDraw: 1,
            pointRules: [
                { id: 'pr_default_1', minDiff: 1, maxDiff: 99, winnerPoints: 3, loserPoints: 0 }
            ],
            tieBreakers: ['goalDifference', 'goalsFor', 'wins', 'headToHead'],
            playoffSettings: [],
            hasBronzeFinal: true,
            consolationSettings: [],
        },
        timeSlots: [],
        playoffs: null,
        consolationBracket: null,
    };

    const updatedTournaments = [...event.tournaments, newTournament];

    // Aggiorna React state
    setEvents(prevEvents => 
        prevEvents.map(e => 
            e.id === event.id 
                ? { ...e, tournaments: updatedTournaments } 
                : e
        )
    );

    // Aggiorna Firestore!
    await updateDoc(doc(db, "events", event.id), {
        tournaments: updatedTournaments
    });

    setNewTournamentName('');
    setIsModalOpen(false);
  }

  // ELIMINA TORNEO E AGGIORNA FIRESTORE
  const handleDeleteTournament = async () => {
    if (!tournamentToDelete) return;
    const updatedTournaments = event.tournaments.filter(t => t.id !== tournamentToDelete.id);

    setEvents(prevEvents => prevEvents.map(e => 
        e.id === event.id
            ? { ...e, tournaments: updatedTournaments }
            : e
    ));

    await updateDoc(doc(db, "events", event.id), {
        tournaments: updatedTournaments
    });

    setTournamentToDelete(null);
  }

  return (
    <div className="space-y-8">
      <div className="bg-secondary p-6 rounded-xl shadow-lg">
        <div className="flex flex-col md:flex-row justify-between md:items-center">
            <h2 className="text-3xl font-bold text-white mb-2 md:mb-0">{event.name}</h2>
            {isOrganizer && (
                 <div className="flex items-center gap-2 bg-primary p-2 rounded-lg">
                    <span className="text-sm text-text-secondary">Codice Invito:</span>
                    <strong className="text-accent font-mono tracking-widest">{event.invitationCode}</strong>
                </div>
            )}
        </div>
      </div>
      
      <div>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-accent">Tornei</h3>
            {isOrganizer && (
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-highlight/80 hover:bg-highlight text-white font-bold py-2 px-4 rounded-lg transition-all shadow-lg shadow-highlight/20">
                    <PlusIcon className="w-5 h-5" />
                    Aggiungi Torneo
                </button>
            )}
        </div>
        {event.tournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {event.tournaments.map(tournament => {
                const { totalMatches, completedMatches, completionPercentage } = (() => {
                    let totalMatches = 0;
                    let completedMatches = 0;
                    tournament.groups.forEach(group => {
                        totalMatches += group.matches.length;
                        completedMatches += group.matches.filter(m => m.status === 'completed').length;
                    });
                    const completionPercentage = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;
                    return { totalMatches, completedMatches, completionPercentage };
                })();
                
                return (
                <div key={tournament.id} className="bg-secondary rounded-xl shadow-md transition-all duration-300 flex flex-col group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-highlight/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="p-6 flex-grow z-10">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                                 <TrophyIcon className="w-6 h-6 text-yellow-400" />
                                 <h4 className="text-lg font-bold">{tournament.name}</h4>
                            </div>
                            {isOrganizer && (
                                 <button onClick={() => setTournamentToDelete(tournament)} className="text-text-secondary/50 hover:text-red-500 transition-colors">
                                    <TrashIcon className="w-5 h-5"/>
                                 </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-text-secondary mb-4">
                        <UsersIcon className="w-5 h-5" />
                        <span>{tournament.groups.length} gironi</span>
                        </div>
                        <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="text-text-secondary">Progresso</span>
                                <span className="font-semibold text-text-primary">{completedMatches} / {totalMatches} partite</span>
                            </div>
                            <div className="w-full bg-tertiary/50 rounded-full h-2.5">
                                <div className="bg-gradient-to-r from-accent to-highlight h-2.5 rounded-full transition-all duration-500" style={{ width: `${completionPercentage}%` }}></div>
                            </div>
                            <div className="text-right text-xs text-text-secondary mt-1">{completionPercentage}% Completato</div>
                        </div>
                    </div>
                    <div className="bg-tertiary/50 p-4 mt-auto z-10">
                        <button 
                        onClick={() => onSelectTournament(tournament)} 
                        className="w-full bg-accent/80 hover:bg-accent text-primary font-bold py-2 px-4 rounded-lg transition-all"
                        >
                        Visualizza Torneo
                        </button>
                    </div>
                </div>
            )})}
            </div>
        ) : (
            <div className="text-center py-10 bg-secondary rounded-xl">
                <p className="text-text-secondary">Nessun torneo ancora creato per questo evento.</p>
            </div>
        )}
      </div>

       {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-sm border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Aggiungi Nuovo Torneo</h4>
            <form onSubmit={handleAddTournament}>
                <input 
                    type="text"
                    placeholder="Nome del torneo"
                    value={newTournamentName}
                    onChange={e => setNewTournamentName(e.target.value)}
                    className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-accent"
                    autoFocus
                />
                <div className="flex justify-end gap-4 mt-6">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Annulla</button>
                    <button type="submit" className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-4 rounded-lg transition-colors">Crea Torneo</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {tournamentToDelete && (
         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
                <h4 className="text-lg font-bold mb-4">Conferma Eliminazione</h4>
                <p className="text-text-secondary">Sei sicuro di voler eliminare il torneo "{tournamentToDelete.name}"? Questa azione è irreversibile.</p>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={() => setTournamentToDelete(null)} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Annulla</button>
                    <button onClick={handleDeleteTournament} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Elimina</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default EventView;