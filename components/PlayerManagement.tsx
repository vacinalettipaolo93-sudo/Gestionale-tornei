import React, { useState, useEffect } from 'react';
import { type Event, type Player } from '../types';
import { TrashIcon, PlusIcon } from './Icons';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface PlayerManagementProps {
  event: Event;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isOrganizer: boolean;
  onPlayerContact?: (player: { phone?: string }) => void;
}

const makeId = () => `${Date.now()}${Math.floor(Math.random() * 10000)}`;

/**
 * Inline fallback icons (simple SVG) to avoid build errors if Icons.tsx
 * doesn't export some icons. These are local-only and don't change UI behavior.
 */
const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M3 21v-3.75L17.81 2.44a1 1 0 0 1 1.41 0l1.34 1.34a1 1 0 0 1 0 1.41L6.75 20.0H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.5 3.5l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SwapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M3 7h13l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 17H8l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PhoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12 1.1.38 2.18.77 3.18a2 2 0 0 1-.45 2.11L8.7 11.7a16 16 0 0 0 6 6l2.7-2.7a2 2 0 0 1 2.11-.45c1 .39 2.08.65 3.18.77A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlayerManagement: React.FC<PlayerManagementProps> = ({ event, setEvents, isOrganizer, onPlayerContact }) => {
  const [players, setPlayers] = useState<Player[]>(event.players ?? []);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [adding, setAdding] = useState(false);

  // For replacement (existing behavior kept)
  const [replacingPlayer, setReplacingPlayer] = useState<Player | null>(null);

  // --- EDIT PLAYER ---
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    setPlayers(event.players ?? []);
  }, [event.players]);

  const handleAddPlayer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPlayerName.trim()) return;
    setAdding(true);
    try {
      const p: Player = {
        id: makeId(),
        name: newPlayerName.trim(),
        phone: newPlayerPhone.trim() || undefined,
        avatar: undefined,
      } as any;
      const updatedPlayers = [...(event.players ?? []), p];
      setPlayers(updatedPlayers);
      setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, players: updatedPlayers } : ev));
      await updateDoc(doc(db, "events", event.id), { players: updatedPlayers });
      setNewPlayerName('');
      setNewPlayerPhone('');
    } catch (err) {
      console.error('Errore aggiunta giocatore', err);
      alert('Errore durante l\'aggiunta del giocatore.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo giocatore? Verranno rimosse anche le sue eventuali assegnazioni.')) return;
    try {
      // Remove player from players list
      const updatedPlayers = (event.players ?? []).filter(p => p.id !== playerId);

      // Also remove player references from tournaments/groups/matches
      const updatedTournaments = (event.tournaments ?? []).map(t => {
        const newGroups = (t.groups ?? []).map(g => {
          const newPlayerIds = (g.playerIds ?? []).filter(id => id !== playerId);
          const newMatches = (g.matches ?? []).filter(m => m.player1Id !== playerId && m.player2Id !== playerId);
          return { ...g, playerIds: newPlayerIds, matches: newMatches };
        });
        return { ...t, groups: newGroups };
      });

      setPlayers(updatedPlayers);
      setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, players: updatedPlayers, tournaments: updatedTournaments } : ev));
      await updateDoc(doc(db, "events", event.id), { players: updatedPlayers, tournaments: updatedTournaments });
    } catch (err) {
      console.error('Errore eliminazione giocatore', err);
      alert('Errore durante l\'eliminazione del giocatore.');
    }
  };

  // Replace player - kept similar to previous behavior (UI triggers setting replacingPlayer)
  const handleReplacePlayer = (player: Player) => {
    setReplacingPlayer(player);
  };

  // --- EDIT: open edit modal ---
  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setEditName(player.name ?? '');
    setEditPhone(player.phone ?? '');
  };

  const closeEditModal = () => {
    setEditingPlayer(null);
    setEditName('');
    setEditPhone('');
  };

  const handleSaveEditPlayer = async () => {
    if (!editingPlayer) return;
    setEditLoading(true);
    try {
      const updatedPlayers = (event.players ?? []).map(p => {
        if (p.id !== editingPlayer.id) return p;
        return { ...p, name: editName.trim(), phone: editPhone.trim() || undefined };
      });

      setPlayers(updatedPlayers);
      setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, players: updatedPlayers } : ev));
      await updateDoc(doc(db, "events", event.id), { players: updatedPlayers });

      closeEditModal();
    } catch (err) {
      console.error('Errore salvataggio giocatore', err);
      alert('Errore durante il salvataggio del giocatore.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleContact = (player: Player) => {
    if (onPlayerContact) {
      onPlayerContact(player);
    } else if (player.phone) {
      window.open(`https://wa.me/${player.phone.replace(/[^0-9]/g, '')}`, '_blank');
    } else {
      alert('Nessun numero disponibile per questo giocatore.');
    }
  };

  return (
    <div className="bg-secondary p-6 rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold mb-0 text-accent">Giocatori ({players.length})</h3>
      </div>

      {isOrganizer && (
        <div className="mb-6 bg-primary/50 p-4 rounded-lg">
          <h4 className="font-semibold mb-3">Aggiungi Nuovo Giocatore</h4>
          <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Nome Cognome"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              className="w-full sm:w-1/2 bg-primary border border-tertiary p-2 rounded"
            />
            <input
              type="text"
              placeholder="Telefono (opzionale)"
              value={newPlayerPhone}
              onChange={e => setNewPlayerPhone(e.target.value)}
              className="w-full sm:w-1/3 bg-primary border border-tertiary p-2 rounded"
            />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={adding} className="bg-highlight text-white px-4 py-2 rounded">
                {adding ? 'Aggiungendo...' : (
                  <span className="flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Aggiungi</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {players.map(p => (
          <div key={p.id} className="bg-primary/30 p-3 rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {p.avatar ? <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full object-cover" /> : (
                <div className="w-10 h-10 rounded-full bg-tertiary flex items-center justify-center text-white font-bold">
                  {p.name?.split(' ').map(n => n[0]).slice(0,2).join('')}
                </div>
              )}
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-text-secondary">{p.phone ?? ''}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOrganizer && (
                <>
                  <button
                    onClick={() => openEditPlayer(p)}
                    title="Modifica giocatore"
                    className="bg-tertiary hover:bg-tertiary/90 px-2 py-1 rounded"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleReplacePlayer(p)}
                    title="Sostituisci giocatore"
                    className="bg-tertiary hover:bg-tertiary/90 px-2 py-1 rounded"
                  >
                    <SwapIcon className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeletePlayer(p.id)}
                    title="Elimina giocatore"
                    className="bg-tertiary hover:bg-tertiary/90 px-2 py-1 rounded"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                onClick={() => handleContact(p)}
                title="Contatta"
                className="bg-accent hover:bg-accent/90 text-white px-3 py-1 rounded"
              >
                <PhoneIcon className="w-3 h-3 inline-block mr-2" />Contatta
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Replace modal - keep previous behavior (if any) */}
      {replacingPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Sostituisci {replacingPlayer.name}</h4>
            <p className="text-sm text-text-secondary mb-4">Seleziona il giocatore che lo sostituirà (tutti i riferimenti verranno aggiornati).</p>
            <div className="grid gap-2 max-h-60 overflow-auto mb-4">
              {(players.filter(pl => pl.id !== replacingPlayer.id)).map(pl => (
                <div key={pl.id} className="flex items-center justify-between bg-primary/30 p-2 rounded">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{pl.name}</div>
                    <div className="text-xs text-text-secondary">{pl.phone ?? ''}</div>
                  </div>
                  <button
                    onClick={async () => {
                      // perform replace: update tournaments/groups/matches to swap ids
                      const fromId = replacingPlayer.id;
                      const toId = pl.id;
                      // update tournaments
                      const updatedTournaments = (event.tournaments ?? []).map(t => {
                        const newGroups = (t.groups ?? []).map(g => {
                          const newPlayerIds = (g.playerIds ?? []).map(id => id === fromId ? toId : id);
                          const newMatches = (g.matches ?? []).map(m => {
                            return {
                              ...m,
                              player1Id: m.player1Id === fromId ? toId : m.player1Id,
                              player2Id: m.player2Id === fromId ? toId : m.player2Id
                            };
                          });
                          return { ...g, playerIds: newPlayerIds, matches: newMatches };
                        });
                        return { ...t, groups: newGroups };
                      });
                      try {
                        setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, tournaments: updatedTournaments } : ev));
                        await updateDoc(doc(db, "events", event.id), { tournaments: updatedTournaments });
                        setReplacingPlayer(null);
                        alert('Sostituzione completata.');
                      } catch (err) {
                        console.error('Errore sostituzione giocatore', err);
                        alert('Errore durante la sostituzione.');
                      }
                    }}
                    className="bg-highlight text-white px-3 py-1 rounded"
                  >
                    Sostituisci con {pl.name}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setReplacingPlayer(null)} className="bg-tertiary px-4 py-2 rounded">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PLAYER MODAL */}
      {editingPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-sm border border-tertiary">
            <h4 className="text-lg font-bold mb-4">Modifica Giocatore</h4>
            <div className="mb-3">
              <label className="text-sm text-text-secondary block mb-1">Nome</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full p-2 rounded bg-primary border"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="text-sm text-text-secondary block mb-1">Telefono</label>
              <input
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                className="w-full p-2 rounded bg-primary border"
                placeholder="Es. +391234567890"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={closeEditModal} className="bg-tertiary px-4 py-2 rounded">Annulla</button>
              <button onClick={handleSaveEditPlayer} disabled={editLoading} className="bg-highlight text-white px-4 py-2 rounded">
                {editLoading ? 'Salvando...' : 'Salva Modifica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerManagement;
