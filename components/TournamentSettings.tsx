import React, { useState } from 'react';
import { type Event, type Tournament } from '../types';
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";

interface TournamentSettingsProps {
  event: Event;
  tournament: Tournament;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}

const TournamentSettings: React.FC<TournamentSettingsProps> = ({ event, tournament, setEvents }) => {
  const [pointsWin, setPointsWin] = useState<number>(tournament.settings.pointsWin ?? 3);
  const [pointsDraw, setPointsDraw] = useState<number>(tournament.settings.pointsDraw ?? 1);
  const [pointsLoss, setPointsLoss] = useState<number>(tournament.settings.pointsLoss ?? 0);
  const [hasBronzeFinal, setHasBronzeFinal] = useState<boolean>(tournament.settings.hasBronzeFinal ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updatedSettings = {
      ...tournament.settings,
      pointsWin,
      pointsDraw,
      pointsLoss,
      hasBronzeFinal,
    };
    setEvents(prev =>
      prev.map(e =>
        e.id === event.id
          ? {
              ...e,
              tournaments: e.tournaments.map(t =>
                t.id === tournament.id
                  ? { ...t, settings: updatedSettings }
                  : t
              ),
            }
          : e
      )
    );
    await updateDoc(doc(db, "events", event.id), {
      tournaments: event.tournaments.map(t =>
        t.id === tournament.id
          ? { ...t, settings: updatedSettings }
          : t
      ),
    });
    setSaving(false);
  };

  return (
    <div className="bg-secondary p-6 rounded-xl shadow-lg max-w-xl mx-auto">
      <h3 className="text-xl font-bold mb-6 text-accent">Impostazioni Torneo</h3>
      <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-6">
        <div>
          <label className="block text-sm text-text-secondary font-semibold mb-1">Punti per Vittoria</label>
          <input
            type="number"
            value={pointsWin}
            min={0}
            onChange={e => setPointsWin(parseInt(e.target.value, 10))}
            className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary font-semibold mb-1">Punti per Pareggio</label>
          <input
            type="number"
            value={pointsDraw}
            min={0}
            onChange={e => setPointsDraw(parseInt(e.target.value, 10))}
            className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary font-semibold mb-1">Punti per Sconfitta</label>
          <input
            type="number"
            value={pointsLoss}
            min={0}
            onChange={e => setPointsLoss(parseInt(e.target.value, 10))}
            className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasBronzeFinal}
            id="bronzeFinal"
            onChange={e => setHasBronzeFinal(e.target.checked)}
            className="w-5 h-5 accent-accent"
          />
          <label htmlFor="bronzeFinal" className="text-sm text-text-secondary font-semibold">
            Abilita Finale 3° Posto
          </label>
        </div>
        <div className="pt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-highlight hover:bg-highlight/90 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg shadow-highlight/20 w-full"
          >
            {saving ? "Salvataggio..." : "Salva Impostazioni"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TournamentSettings;