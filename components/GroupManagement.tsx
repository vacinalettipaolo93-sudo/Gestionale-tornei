import React, { useState } from 'react';
import { type Event, type Tournament, type Group } from '../types';
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const makeId = () => Math.random().toString(36).substring(2, 12);

interface GroupManagementProps {
    event: Event;
    tournament: Tournament;
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}

const GroupManagement: React.FC<GroupManagementProps> = ({ event, tournament, setEvents }) => {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupSize, setNewGroupSize] = useState(4);
    const [editGroupName, setEditGroupName] = useState('');
    const [editGroupSize, setEditGroupSize] = useState(0);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openAddGroup = () => {
        setNewGroupName('');
        setNewGroupSize(4);
        setError(null);
        setIsAddOpen(true);
    };

    const handleAddGroup = async () => {
        setLoading(true);
        setError(null);
        try {
            const newGroup: Group = {
                id: makeId(),
                name: newGroupName || `Girone ${Array.isArray(tournament.groups) ? tournament.groups.length + 1 : 1}`,
                playerIds: [],
                matches: []
            };

            const updatedGroups = Array.isArray(tournament.groups)
                ? [...tournament.groups, newGroup]
                : [newGroup];

            setEvents(prevEvents => prevEvents.map(e => {
                if (e.id !== event.id) return e;
                return {
                    ...e,
                    tournaments: e.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
                };
            }));

            await updateDoc(doc(db, "events", event.id), {
                tournaments: event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
            });

            setIsAddOpen(false);
        } catch (err: any) {
            setError(err?.message || 'Errore durante la creazione del girone');
        } finally {
            setLoading(false);
        }
    };

    const openEditGroup = (g: Group) => {
        setEditingGroup(g);
        setEditGroupName(g.name);
        setEditGroupSize(Array.isArray(g.playerIds) ? g.playerIds.length : 0);
        setError(null);
        setIsEditOpen(true);
    };

    const handleSaveEditGroup = async () => {
        if (!editingGroup) return;
        setLoading(true);
        setError(null);
        try {
            const original = editingGroup;
            const targetSize = Math.max(0, Math.floor(editGroupSize));
            let newPlayerIds = Array.isArray(original.playerIds) ? original.playerIds.slice(0, targetSize) : [];

            if (targetSize > (Array.isArray(original.playerIds) ? original.playerIds.length : 0)) {
                newPlayerIds = Array.isArray(original.playerIds) ? original.playerIds : [];
            }
            const removedPlayerIds = Array.isArray(original.playerIds) ? original.playerIds.slice(targetSize) : [];
            const newMatches = Array.isArray(original.matches)
                ? original.matches.filter(m =>
                    !removedPlayerIds.includes(m.player1Id) && !removedPlayerIds.includes(m.player2Id)
                ) : [];

            const updatedGroup: Group = {
                ...original,
                name: editGroupName,
                playerIds: newPlayerIds,
                matches: newMatches
            };

            const updatedGroups = Array.isArray(tournament.groups)
                ? tournament.groups.map(g => g.id === updatedGroup.id ? updatedGroup : g)
                : [updatedGroup];

            setEvents(prevEvents => prevEvents.map(e => {
                if (e.id !== event.id) return e;
                return {
                    ...e,
                    tournaments: e.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
                };
            }));

            await updateDoc(doc(db, "events", event.id), {
                tournaments: event.tournaments.map(t => t.id === tournament.id ? { ...t, groups: updatedGroups } : t)
            });

            setIsEditOpen(false);
        } catch (err: any) {
            setError(err?.message || 'Errore durante la modifica del girone');
        } finally {
            setLoading(false);
        }
    };

    // ...Rest of your component UI code...
    return (
      <div>
        {/* Implementa qui la tua gestione visuale dei gironi */}
        {/* Usa sempre Array.isArray su tournament.groups e group.playerIds */}
      </div>
    );
};

export default GroupManagement;
