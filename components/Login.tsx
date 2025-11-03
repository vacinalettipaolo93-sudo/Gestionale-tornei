import React, { useState } from 'react';
import { type User } from '../types';
import { TrophyIcon } from './Icons';

interface LoginProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username.trim().toLowerCase() === username.trim().toLowerCase() && u.password === password);
    if (user) {
      onLoginSuccess(user);
    } else {
      setError('Username o password non validi.');
    }
  };

  return (
    <div className="min-h-screen bg-primary text-text-primary flex flex-col items-center justify-center p-4 animate-fadeIn">
        <div className="w-full max-w-sm">
            <div className="flex flex-col items-center mb-8">
                <TrophyIcon className="w-12 h-12 text-accent" />
                <h1 className="text-3xl font-bold tracking-tight mt-2">Tournament Manager Pro</h1>
                <p className="text-text-secondary">Accedi per continuare</p>
            </div>
            <div className="bg-secondary p-8 rounded-xl shadow-2xl border border-tertiary/50">
                <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-text-secondary">Username</label>
                    <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="mt-1 block w-full bg-primary border border-tertiary rounded-lg p-3 text-text-primary focus:ring-2 focus:ring-accent focus:border-accent"
                    />
                </div>

                <div>
                    <label htmlFor="password"className="block text-sm font-medium text-text-secondary">Password</label>
                    <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="mt-1 block w-full bg-primary border border-tertiary rounded-lg p-3 text-text-primary focus:ring-2 focus:ring-accent focus:border-accent"
                    />
                </div>
                
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                <div>
                    <button
                    type="submit"
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg shadow-highlight/20 text-sm font-medium text-white bg-highlight hover:bg-highlight/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition-all"
                    >
                    Accedi
                    </button>
                </div>
                </form>
            </div>
            {/* SUGGERIMENTO PERSONALIZZATO */}
            <div className="text-center mt-4 text-xs text-text-secondary/50">
                <p>Partecipante: <strong>Nome Cognome</strong> / <strong>1234</strong></p>
            </div>
        </div>
    </div>
  );
};

export default Login;