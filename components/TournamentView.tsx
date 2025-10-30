import React, { useEffect, useRef, useState } from 'react';
import { type Event, type Tournament, type Match, type TimeSlot, type Player, type Group } from '../types';
import { updateDoc, doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import MatchList from './MatchList';
import TimeSlots from './TimeSlots';
import StandingsTable from './StandingsTable';
import PlayerManagement from './PlayerManagement';
import ChatPanel from './ChatPanel';
import GroupManagement from './GroupManagement';
import TournamentSettings from './TournamentSettings';
import Playoffs from './Playoffs';
import ConsolationBracket from './ConsolationBracket';

/*
  Modern score editor + anchored positioning:
  - MatchList now passes anchor rect when opening the editor.
  - TournamentView keeps anchorRect in state and positions the editor near it (fixed).
  - Inputs are large, black, bold, with +/- controls and Enter to save.
*/

const TournamentView: React.FC<{
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  loggedInPlayerId?: string;
  onPlayerContact: (p: Player) => void;
}> = ({ event, tournament, setEvents, isOrganizer, loggedInPlayerId, onPlayerContact }) => {
  const [activeTab, setActiveTab] = useState<'standings'|'matches'|'players'|'timeSlots'|'playoffs'|'consolation'|'groupManagement'|'settings'|'chat'>('standings');

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(tournament.groups.length > 0 ? tournament.groups[0].id : null);
  const [viewingOtherGroups, setViewingOtherGroups] = useState(false);

  // booking/reschedule...
  const [bookingMatch, setBookingMatch] = useState<Match | null>(null);
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null);
  const [rescheduleMatch, setRescheduleMatch] = useState<Match | null>(null);

  // Modern score editor state
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const userGroupId = loggedInPlayerId ? tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId))?.id : undefined;
  useEffect(() => {
    if (!isOrganizer && loggedInPlayerId) {
      const myGroup = tournament.groups.find(g => g.playerIds.includes(loggedInPlayerId));
      if (myGroup) {
        setSelectedGroupId(myGroup.id);
        setViewingOtherGroups(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.id, loggedInPlayerId, isOrganizer]);

  const selectedGroup: Group | null = selectedGroupId ? (tournament.groups.find(g => g.id === selectedGroupId) ?? null) : null;
  const isViewingOwnGroup = !viewingOtherGroups && !!userGroupId && selectedGroupId === userGroupId;

  // Minimal handleUpdateEvents (same as before)
  const handleUpdateEvents = async (updater: (prevEvents: Event[]) => Event[]) => {
    setEvents(updater);
    const updatedEvents = updater([event]);
    const updatedEvent = updatedEvents.find(e => e.id === event.id);
    if (updatedEvent) {
      await updateDoc(doc(db, "events", event.id), updatedEvent);
    }
  };

  // ... (booking/reschedule/cancel/delete/update functions remain unchanged - omitted here for brevity)
  // For the purposes of this change we keep them as previously implemented in your codebase.

  // Modern editor: open with anchorRect (optional)
  const handleEditResult = (match: Match, rect?: DOMRect | null) => {
    setEditingMatch(match);
    setScore1(match.score1 != null ? String(match.score1) : '');
    setScore2(match.score2 != null ? String(match.score2) : '');
    setAnchorRect(rect ?? null);

    // ensure editor will be visible: if rect provided, try to scroll that area into view slightly
    if (rect) {
      // Bring the area around the anchor into view (if the user is scrolled far away)
      window.scrollTo({
        top: Math.max(0, window.scrollY + rect.top - 120),
        behavior: 'smooth'
      });
    }
    // Next tick, focus the first input via ref
    setTimeout(() => {
      editorRef.current?.querySelector<HTMLInputElement>('input[name="score1"]')?.focus();
    }, 250);
  };

  // save result (reuse existing update logic)
  const handleSaveResult = async () => {
    if (!editingMatch) return;
    const s1 = parseInt(score1, 10);
    const s2 = parseInt(score2, 10);
    if (isNaN(s1) || isNaN(s2)) return;

    // Use existing update function pattern: update local state + firestore via handleUpdateEvents
    await handleUpdateEvents(prevEvents => prevEvents.map(e => {
      if (e.id !== event.id) return e;
      return {
        ...e,
        tournaments: e.tournaments.map(t => {
          if (t.id !== tournament.id) return t;
          return {
            ...t,
            groups: t.groups.map(g => ({
              ...g,
              matches: g.matches.map(m =>
                m.id === editingMatch.id ? { ...m, score1: s1, score2: s2, status: 'completed' } : m
              )
            }))
          };
        })
      };
    }));

    setEditingMatch(null);
    setAnchorRect(null);
    setScore1('');
    setScore2('');
  };

  const getPlayer = (playerId?: string) => event.players.find(p => p.id === playerId);

  // Positioning helper for editor: compute style
  const computeEditorStyle = (): React.CSSProperties => {
    const width = Math.min(420, Math.max(320, window.innerWidth * 0.9));
    const height = 220;
    if (!anchorRect) {
      // centered fallback
      return {
        position: 'fixed',
        left: `calc(50% - ${width / 2}px)`,
        top: `calc(50% - ${height / 2}px)`,
        width,
        zIndex: 70
      };
    }
    // try to position below the anchor if space, else above
    const margin = 8;
    const belowTop = window.scrollY + anchorRect.bottom + margin;
    const aboveTop = window.scrollY + anchorRect.top - margin - height;
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, window.scrollX + anchorRect.left));
    const top = (belowTop + height <= window.scrollY + window.innerHeight) ? belowTop : (aboveTop >= 0 ? aboveTop : Math.max(12, window.scrollY + 60));
    return {
      position: 'fixed',
      left,
      top,
      width,
      zIndex: 70
    };
  };

  // +/- helpers for inputs
  const inc = (setter: (s: string) => void, val: string) => {
    const n = parseInt(val || '0', 10) || 0;
    setter(String(n + 1));
  };
  const dec = (setter: (s: string) => void, val: string) => {
    const n = parseInt(val || '0', 10) || 0;
    setter(String(Math.max(0, n - 1)));
  };

  return (
    <div>
      {/* NAV simplified/unchanged (use your existing nav) */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('standings')} className={activeTab === 'standings' ? 'font-bold' : ''}>Classifica</button>
        <button onClick={() => setActiveTab('matches')} className={activeTab === 'matches' ? 'font-bold' : ''}>Partite</button>
        <button onClick={() => setActiveTab('players')} className={activeTab === 'players' ? 'font-bold' : ''}>Giocatori</button>
        <button onClick={() => setActiveTab('timeSlots')} className={activeTab === 'timeSlots' ? 'font-bold' : ''}>Slot Orari</button>
        {isOrganizer ? (
          <>
            <button onClick={() => setActiveTab('playoffs')} className={activeTab === 'playoffs' ? 'font-bold' : ''}>Playoffs</button>
            <button onClick={() => setActiveTab('consolation')} className={activeTab === 'consolation' ? 'font-bold' : ''}>Consolation</button>
          </>
        ) : (
          <>
            {tournament.playoffs && <button onClick={() => setActiveTab('playoffs')} className={activeTab === 'playoffs' ? 'font-bold' : ''}>Playoffs</button>}
            {tournament.consolationBracket && <button onClick={() => setActiveTab('consolation')} className={activeTab === 'consolation' ? 'font-bold' : ''}>Consolation</button>}
          </>
        )}
        {isOrganizer && <button onClick={() => setActiveTab('groupManagement')} className={activeTab === 'groupManagement' ? 'font-bold' : ''}>Gestione Gironi</button>}
        {isOrganizer && <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'font-bold' : ''}>Impostazioni</button>}
        <button onClick={() => setActiveTab('chat')} className={activeTab === 'chat' ? 'font-bold' : ''}>Chat</button>
      </div>

      <div className="animate-fadeIn">
        {activeTab === 'standings' && selectedGroup && (
          <StandingsTable group={selectedGroup} players={event.players} settings={tournament.settings} loggedInPlayerId={loggedInPlayerId} onPlayerContact={onPlayerContact} />
        )}

        {activeTab === 'matches' && selectedGroup && (
          <MatchList
            group={selectedGroup}
            players={event.players}
            onEditResult={handleEditResult}
            onBookMatch={() => {}}
            isOrganizer={isOrganizer}
            loggedInPlayerId={loggedInPlayerId}
            onPlayerContact={onPlayerContact}
            onRescheduleMatch={(m) => setRescheduleMatch(m)}
            onCancelBooking={() => {}}
            onDeleteResult={() => {}}
            viewingOwnGroup={isViewingOwnGroup || isOrganizer}
          />
        )}

        {/* other tabs omitted for brevity in this snippet */}
      </div>

      {/* ---------- Modern anchored score editor ---------- */}
      {editingMatch && (
        <>
          {/* dim background */}
          <div
            onClick={() => { setEditingMatch(null); setAnchorRect(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60 }}
          />

          <div
            ref={editorRef}
            role="dialog"
            aria-modal="true"
            style={computeEditorStyle()}
            className="rounded-xl bg-secondary shadow-2xl border border-tertiary p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-text-secondary">Risultato</div>
                <div className="font-semibold text-lg">{getPlayer(editingMatch.player1Id)?.name} <span className="text-sm text-text-secondary">vs</span> {getPlayer(editingMatch.player2Id)?.name}</div>
              </div>
              <button onClick={() => { setEditingMatch(null); setAnchorRect(null); }} className="text-text-secondary hover:text-red-500">Chiudi ✕</button>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <div className="flex flex-col items-center">
                <div className="text-sm text-text-secondary mb-1">{getPlayer(editingMatch.player1Id)?.name}</div>
                <div className="flex items-center gap-2">
                  <button aria-label="decrement" onClick={() => dec(setScore1, score1)} className="w-8 h-8 rounded bg-tertiary flex items-center justify-center">−</button>
                  <input
                    name="score1"
                    value={score1}
                    onChange={e => setScore1(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveResult(); }}
                    className="w-20 text-center text-black font-extrabold text-2xl border rounded p-2"
                    inputMode="numeric"
                    aria-label="Punteggio giocatore 1"
                  />
                  <button aria-label="increment" onClick={() => inc(setScore1, score1)} className="w-8 h-8 rounded bg-tertiary flex items-center justify-center">+</button>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-sm text-text-secondary mb-1">—</div>
                <div className="text-2xl font-bold text-center">:</div>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-sm text-text-secondary mb-1">{getPlayer(editingMatch.player2Id)?.name}</div>
                <div className="flex items-center gap-2">
                  <button aria-label="decrement" onClick={() => dec(setScore2, score2)} className="w-8 h-8 rounded bg-tertiary flex items-center justify-center">−</button>
                  <input
                    name="score2"
                    value={score2}
                    onChange={e => setScore2(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveResult(); }}
                    className="w-20 text-center text-black font-extrabold text-2xl border rounded p-2"
                    inputMode="numeric"
                    aria-label="Punteggio giocatore 2"
                  />
                  <button aria-label="increment" onClick={() => inc(setScore2, score2)} className="w-8 h-8 rounded bg-tertiary flex items-center justify-center">+</button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setEditingMatch(null); setAnchorRect(null); }} className="bg-tertiary px-4 py-2 rounded">Annulla</button>
              <button onClick={handleSaveResult} className="bg-highlight px-4 py-2 rounded text-white font-bold">Salva</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TournamentView;
