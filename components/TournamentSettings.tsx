import React, { useState, useEffect } from 'react';
import { type Event, type Tournament, type TournamentSettings, type PointRule, type TieBreaker, PlayoffSetting, ConsolationSetting } from '../types';
import { TrashIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon } from './Icons';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface TournamentSettingsProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}

const tieBreakerLabels: Record<TieBreaker, string> = {
    goalDifference: 'Differenza Game',
    goalsFor: 'Game Fatti',
    wins: 'Numero Vittorie',
    headToHead: 'Scontro Diretto',
};

const TournamentSettings: React.FC<TournamentSettingsProps> = ({ event, tournament, setEvents }) => {
    const [settings, setSettings] = useState<TournamentSettings>(tournament.settings);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setSettings(tournament.settings);
    }, [tournament]);
    
    const handleRuleChange = (ruleId: string, field: keyof PointRule, value: string) => {
        const numericValue = parseInt(value, 10) || 0;
        setSettings(prev => ({
            ...prev,
            pointRules: prev.pointRules.map(rule => 
                rule.id === ruleId ? { ...rule, [field]: numericValue } : rule
            )
        }));
    };

    const handleAddRule = () => {
        const newRule: PointRule = {
            id: `pr_${Date.now()}`,
            minDiff: 1,
            maxDiff: 1,
            winnerPoints: 3,
            loserPoints: 0,
        };
        setSettings(prev => ({
            ...prev,
            pointRules: [...prev.pointRules, newRule]
        }));
    };

    const handleRemoveRule = (ruleId: string) => {
        setSettings(prev => ({
            ...prev,
            pointRules: prev.pointRules.filter(rule => rule.id !== ruleId)
        }));
    };
    
    const handleMoveTieBreaker = (index: number, direction: 'up' | 'down') => {
        const newTieBreakers = [...settings.tieBreakers];
        const item = newTieBreakers[index];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (swapIndex < 0 || swapIndex >= newTieBreakers.length) return;

        newTieBreakers[index] = newTieBreakers[swapIndex];
        newTieBreakers[swapIndex] = item;
        setSettings(prev => ({...prev, tieBreakers: newTieBreakers}));
    };

    const handlePlayoffSettingChange = (groupId: string, value: string) => {
        const num = parseInt(value, 10) || 0;
        const groupPlayerCount = tournament.groups.find(g => g.id === groupId)?.playerIds.length ?? 0;
        if (num > groupPlayerCount) return;

        setSettings(prev => {
            const existing = prev.playoffSettings.find(s => s.groupId === groupId);
            let newPlayoffSettings: PlayoffSetting[];
            if (existing) {
                newPlayoffSettings = prev.playoffSettings.map(s => s.groupId === groupId ? { ...s, numQualifiers: num } : s);
            } else {
                 newPlayoffSettings = [...prev.playoffSettings, { groupId, numQualifiers: num }];
            }
            return {...prev, playoffSettings: newPlayoffSettings};
        });
    };

    const handleConsolationSettingChange = (groupId: string, field: 'startRank' | 'endRank', value: string) => {
        const num = parseInt(value, 10) || 0;
        
        setSettings(prev => {
            const existing = prev.consolationSettings.find(s => s.groupId === groupId);
            let newConsolationSettings: ConsolationSetting[];
            if (existing) {
                newConsolationSettings = prev.consolationSettings.map(s => 
                    s.groupId === groupId ? { ...s, [field]: num } : s
                );
            } else {
                newConsolationSettings = [...prev.consolationSettings, { groupId, startRank: 0, endRank: 0, [field]: num }];
            }
            newConsolationSettings = newConsolationSettings.filter(s => s.startRank !== 0 || s.endRank !== 0);

            return {...prev, consolationSettings: newConsolationSettings};
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Aggiorna React state
        setEvents(prevEvents => prevEvents.map(ev => 
            ev.id === event.id ? {
                ...ev,
                tournaments: ev.tournaments.map(t => 
                    t.id === tournament.id ? { ...t, settings } : t
                )
            } : ev
        ));
        // Aggiorna Firestore
        await updateDoc(doc(db, "events", event.id), {
            tournaments: event.tournaments.map(t =>
                t.id === tournament.id ? { ...t, settings } : t
            )
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const inputClasses = "w-16 text-center bg-primary p-2 rounded-lg border border-tertiary focus:ring-2 focus:ring-accent";

    return (
        <div className="bg-secondary p-6 rounded-xl shadow-lg max-w-3xl mx-auto">
            <h3 className="text-xl font-bold mb-6 text-accent">Impostazioni Torneo</h3>
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Point Rules Section */}
                <div>
                    <h4 className="text-lg font-semibold mb-3 text-text-primary">Regole Punteggio per Vittoria</h4>
                    <div className="space-y-3 bg-primary/50 p-4 rounded-lg">
                        {settings.pointRules.map(rule => (
                            <div key={rule.id} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                                <div className="col-span-1 sm:col-span-2 flex items-center gap-2">
                                    <span className="text-sm">Se diff. game è tra</span>
                                    <input type="number" value={rule.minDiff} onChange={e => handleRuleChange(rule.id, 'minDiff', e.target.value)} className={inputClasses}/>
                                    <span>e</span>
                                    <input type="number" value={rule.maxDiff} onChange={e => handleRuleChange(rule.id, 'maxDiff', e.target.value)} className={inputClasses}/>
                                </div>
                                 <div className="col-span-1 sm:col-span-2 flex items-center gap-2">
                                    <span className="text-sm">Punti:</span>
                                    <input type="number" value={rule.winnerPoints} onChange={e => handleRuleChange(rule.id, 'winnerPoints', e.target.value)} className={inputClasses} title="Punti Vincitore"/>
                                    <span>(V)</span>
                                     <input type="number" value={rule.loserPoints} onChange={e => handleRuleChange(rule.id, 'loserPoints', e.target.value)} className={inputClasses} title="Punti Sconfitto"/>
                                    <span>(S)</span>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button type="button" onClick={() => handleRemoveRule(rule.id)} className="text-text-secondary/50 hover:text-red-500 transition-colors p-2"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </div>
                        ))}
                         <button type="button" onClick={handleAddRule} className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover font-semibold mt-2">
                            <PlusIcon className="w-5 h-5" />
                            Aggiungi Regola
                        </button>
                    </div>
                </div>

                {/* Draw Points */}
                <div>
                    <label htmlFor="pointsPerDraw" className="block mb-1 text-lg font-semibold text-text-primary">Punti per Pareggio</label>
                    <input
                        type="number"
                        id="pointsPerDraw"
                        name="pointsPerDraw"
                        value={settings.pointsPerDraw}
                        onChange={e => setSettings({...settings, pointsPerDraw: parseInt(e.target.value, 10) || 0})}
                        className="w-40 bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
                    />
                </div>

                {/* Tie Breakers */}
                <div>
                     <h4 className="text-lg font-semibold mb-3 text-text-primary">Criteri Ordine Classifica (in caso di parità)</h4>
                     <div className="space-y-2 bg-primary/50 p-4 rounded-lg max-w-sm">
                        {settings.tieBreakers.map((tb, index) => (
                            <div key={tb} className="flex items-center justify-between bg-tertiary/50 p-2 rounded-lg">
                                <span className="font-medium">{index+1}. {tieBreakerLabels[tb]}</span>
                                <div className="flex items-center">
                                    <button type="button" onClick={() => handleMoveTieBreaker(index, 'up')} disabled={index === 0} className="p-1 disabled:opacity-30 text-text-secondary hover:text-text-primary"><ArrowUpIcon className="w-5 h-5"/></button>
                                    <button type="button" onClick={() => handleMoveTieBreaker(index, 'down')} disabled={index === settings.tieBreakers.length - 1} className="p-1 disabled:opacity-30 text-text-secondary hover:text-text-primary"><ArrowDownIcon className="w-5 h-5"/></button>
                                </div>
                            </div>
                        ))}
                     </div>
                </div>

                 {/* Playoff Settings */}
                <div>
                     <h4 className="text-lg font-semibold mb-3 text-text-primary">Impostazioni Playoff</h4>
                     <div className="space-y-3 bg-primary/50 p-4 rounded-lg max-w-sm">
                        <div className="mb-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.hasBronzeFinal}
                                    onChange={e => setSettings({ ...settings, hasBronzeFinal: e.target.checked })}
                                    className="w-5 h-5 rounded bg-primary border-tertiary text-accent focus:ring-accent ring-offset-secondary"
                                />
                                <span>Includi Finale 3°/4° Posto</span>
                            </label>
                        </div>
                        <p className="text-sm text-text-secondary pt-2 border-t border-tertiary/50">Specifica quanti giocatori si qualificano da ogni girone.</p>
                        {tournament.groups.map(group => (
                            <div key={group.id} className="flex items-center justify-between">
                                <label htmlFor={`qualifiers-${group.id}`} className="font-medium">{group.name}</label>
                                <select 
                                    id={`qualifiers-${group.id}`}
                                    value={settings.playoffSettings.find(s => s.groupId === group.id)?.numQualifiers ?? 0}
                                    onChange={(e) => handlePlayoffSettingChange(group.id, e.target.value)}
                                    className="w-24 bg-tertiary border border-tertiary/50 rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent"
                                >
                                    {[...Array((group.playerIds.length || 0) + 1).keys()].map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                        ))}
                         {tournament.groups.length === 0 && <p className="text-text-secondary">Crea prima i gironi.</p>}
                     </div>
                </div>

                 {/* Consolation Bracket Settings */}
                <div>
                     <h4 className="text-lg font-semibold mb-3 text-text-primary">Impostazioni Tabellone di Consolazione</h4>
                     <div className="space-y-3 bg-primary/50 p-4 rounded-lg max-w-sm">
                        <p className="text-sm text-text-secondary">Specifica quali giocatori si qualificano (es. dal 4° al 5° posto).</p>
                         {tournament.groups.map(group => {
                            const groupSetting = settings.consolationSettings.find(s => s.groupId === group.id);
                            const startRank = groupSetting?.startRank ?? 0;
                            const endRank = groupSetting?.endRank ?? 0;
                            const ranks = [...Array((group.playerIds.length || 0) + 1).keys()];

                            return (
                                <div key={group.id} className="flex items-center justify-between gap-2">
                                    <label htmlFor={`consolation-start-${group.id}`} className="font-medium flex-1">{group.name}</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">Dal</span>
                                        <select 
                                            id={`consolation-start-${group.id}`}
                                            value={startRank}
                                            onChange={(e) => handleConsolationSettingChange(group.id, 'startRank', e.target.value)}
                                            className="w-20 bg-tertiary border border-tertiary/50 rounded-lg p-1 text-text-primary text-sm focus:ring-2 focus:ring-accent"
                                        >
                                            {ranks.map(i => <option key={i} value={i}>{i === 0 ? 'N/A' : `${i}°`}</option>)}
                                        </select>
                                        <span className="text-sm">al</span>
                                        <select 
                                            id={`consolation-end-${group.id}`}
                                            value={endRank}
                                            onChange={(e) => handleConsolationSettingChange(group.id, 'endRank', e.target.value)}
                                            className="w-20 bg-tertiary border border-tertiary/50 rounded-lg p-1 text-text-primary text-sm focus:ring-2 focus:ring-accent"
                                        >
                                            {ranks.map(i => <option key={i} value={i}>{i === 0 ? 'N/A' : `${i}°`}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )
                        })}
                         {tournament.groups.length === 0 && <p className="text-text-secondary">Crea prima i gironi.</p>}
                     </div>
                </div>

                <div className="flex items-center justify-end pt-4">
                    {saved && <span className="text-green-400 mr-4 transition-opacity duration-300 animate-fadeIn">Impostazioni salvate!</span>}
                    <button type="submit" className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-lg shadow-highlight/20">
                        Salva Impostazioni
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TournamentSettings;