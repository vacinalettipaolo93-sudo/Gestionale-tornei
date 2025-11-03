import React, { useState } from 'react';
import { type User, type Event } from '../types';
import { FaceSmileIcon, LinkIcon, PhotoIcon } from './Icons';

interface EditProfileModalProps {
  user: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  onClose: () => void;
}

const EMOJIS = ['🏓', '🎾', '⚽', '🏆', '🥇', '😎', '💪', '🔥', '🚀', '🎯', '👑', '🤖'];

const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, users, setUsers, events, setEvents, onClose }) => {
  const [activeTab, setActiveTab] = useState<'password' | 'avatar'>('password');
  
  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Avatar state
  const [imageUrl, setImageUrl] = useState('');

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    const currentUserState = users.find(u => u.id === user.id);
    if (!currentUserState || currentUserState.password !== oldPassword) {
      setPasswordError('La vecchia password non è corretta.');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('La nuova password deve essere di almeno 4 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Le nuove password non coincidono.');
      return;
    }

    setUsers(prevUsers =>
      prevUsers.map(u => (u.id === user.id ? { ...u, password: newPassword } : u))
    );

    setPasswordSuccess('Password modificata con successo!');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => {
        setPasswordSuccess('');
    }, 2000);
  };

  const handleAvatarUpdate = (newAvatar: string) => {
    if (!user.playerId) return;

    setEvents(prevEvents => prevEvents.map(event => ({
        ...event,
        players: event.players.map(p =>
            p.id === user.playerId ? { ...p, avatar: newAvatar } : p
        )
    })));
  };

  const emojiToSvgDataUrl = (emoji: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><text x="50" y="50" font-size="80" text-anchor="middle" dominant-baseline="central" dy=".1em">${emoji}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleAvatarUpdate(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (imageUrl.trim()) {
        handleAvatarUpdate(imageUrl.trim());
        setImageUrl('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-secondary rounded-xl shadow-2xl w-full max-w-md border border-tertiary">
        <div className="flex border-b border-tertiary">
            <button onClick={() => setActiveTab('password')} className={`flex-1 p-3 font-semibold transition-colors ${activeTab === 'password' ? 'bg-tertiary/70 text-accent' : 'text-text-secondary hover:bg-tertiary/40'}`}>
                Cambia Password
            </button>
             <button onClick={() => setActiveTab('avatar')} className={`flex-1 p-3 font-semibold transition-colors ${activeTab === 'avatar' ? 'bg-tertiary/70 text-accent' : 'text-text-secondary hover:bg-tertiary/40'}`}>
                Modifica Avatar
            </button>
        </div>
        <div className="p-6">
            {activeTab === 'password' && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-fadeIn">
                <h4 className="text-lg font-bold mb-2">Profilo di {user.username}</h4>
                <div>
                    <label className="block text-sm font-medium text-text-secondary">Vecchia Password</label>
                    <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="mt-1 block w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary">Nuova Password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 block w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary">Conferma Nuova Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent" required />
                </div>

                {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
                {passwordSuccess && <p className="text-sm text-green-400">{passwordSuccess}</p>}

                <div className="flex justify-end gap-4 pt-2">
                    <button type="button" onClick={onClose} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Chiudi</button>
                    <button type="submit" className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-4 rounded-lg transition-colors">Salva Modifiche</button>
                </div>
                </form>
            )}

            {activeTab === 'avatar' && (
              <>
                {user.role === 'participant' ? (
                    <div className="space-y-6 animate-fadeIn">
                        <h4 className="text-lg font-bold">Personalizza il tuo Avatar</h4>
                        <div>
                            <h5 className="flex items-center gap-2 text-sm font-semibold text-text-secondary mb-2"><FaceSmileIcon className="w-5 h-5"/> Scegli un Emoji</h5>
                            <div className="grid grid-cols-6 gap-2 bg-primary/50 p-3 rounded-lg">
                                {EMOJIS.map(emoji => (
                                    <button key={emoji} onClick={() => handleAvatarUpdate(emojiToSvgDataUrl(emoji))} className="text-3xl rounded-lg hover:bg-tertiary transition-colors p-1">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h5 className="flex items-center gap-2 text-sm font-semibold text-text-secondary mb-2"><LinkIcon className="w-5 h-5"/> Incolla URL Immagine</h5>
                            <form onSubmit={handleUrlSubmit} className="flex gap-2">
                                <input type="url" placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-grow bg-primary border border-tertiary rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-accent" />
                                <button type="submit" className="bg-highlight hover:bg-highlight/80 text-white font-bold py-2 px-3 rounded-lg transition-colors">Imposta</button>
                            </form>
                        </div>

                        <div>
                            <h5 className="flex items-center gap-2 text-sm font-semibold text-text-secondary mb-2"><PhotoIcon className="w-5 h-5"/> Carica dal tuo dispositivo</h5>
                            <label htmlFor="avatar-upload" className="w-full text-center block bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer">
                            Scegli un file...
                            </label>
                            <input id="avatar-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </div>
                        <div className="flex justify-end pt-2">
                            <button type="button" onClick={onClose} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Chiudi</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-8 animate-fadeIn">
                        <p className="text-text-secondary">La personalizzazione dell'avatar non è disponibile per l'organizzatore.</p>
                        <div className="flex justify-end pt-6">
                            <button type="button" onClick={onClose} className="bg-tertiary hover:bg-tertiary/80 text-text-primary font-bold py-2 px-4 rounded-lg transition-colors">Chiudi</button>
                        </div>
                    </div>
                )}
              </>
            )}
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;