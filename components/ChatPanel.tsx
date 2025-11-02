import React, { useState } from 'react';

type ChatType = 'tournament' | 'group' | 'private';

const ChatPanel: React.FC = () => {
    const [activeChat, setActiveChat] = useState<ChatType>('tournament');

    const renderChatContent = () => {
        switch (activeChat) {
            case 'tournament':
                return <p className="text-center text-text-secondary">La chat del campionato non è ancora attiva.</p>;
            case 'group':
                return <p className="text-center text-text-secondary">La chat del girone non è ancora attiva.</p>;
            case 'private':
                return <p className="text-center text-text-secondary">Seleziona un avversario per iniziare una chat privata.</p>;
        }
    };
    
    return (
        <div className="bg-secondary p-6 rounded-xl shadow-lg h-[400px] flex flex-col">
            <h3 className="text-xl font-bold mb-4 text-accent">Comunicazioni</h3>
            <div className="flex border-b border-tertiary/50 mb-4">
                <button 
                    onClick={() => setActiveChat('tournament')}
                    className={`px-4 py-2 font-semibold transition-colors border-b-2 ${activeChat === 'tournament' ? 'border-accent text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                >
                    Campionato
                </button>
                <button 
                    onClick={() => setActiveChat('group')}
                    className={`px-4 py-2 font-semibold transition-colors border-b-2 ${activeChat === 'group' ? 'border-accent text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                >
                    Girone
                </button>
                 <button 
                    onClick={() => setActiveChat('private')}
                    className={`px-4 py-2 font-semibold transition-colors border-b-2 ${activeChat === 'private' ? 'border-accent text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                >
                    Privata
                </button>
            </div>
            <div className="flex-grow flex items-center justify-center p-4 bg-primary/50 rounded-lg">
                {renderChatContent()}
            </div>
            <div className="mt-4">
                <input
                    type="text"
                    placeholder="La chat non è implementata in questa demo..."
                    disabled
                    className="w-full bg-primary border border-tertiary rounded-lg p-2 text-text-primary placeholder-text-secondary/50 cursor-not-allowed"
                />
            </div>
        </div>
    );
};

export default ChatPanel;