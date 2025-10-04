import React, { useState, useEffect } from 'react';

// FIREBASE IMPORTS
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";

type ChatType = 'tournament' | 'group' | 'private';

interface Message {
    id?: string;
    chatType: ChatType;
    sender: string;
    text: string;
    timestamp: number;
}

const ChatPanel: React.FC = () => {
    const [activeChat, setActiveChat] = useState<ChatType>('tournament');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");

    // TODO: Passa currentUser come prop/context per chat reali!
    const currentUser = { username: "DemoUser" };

    useEffect(() => {
        const q = query(
            collection(db, "messages"),
            orderBy("timestamp")
        );
        const unsub = onSnapshot(q, (snapshot) => {
            setMessages(
                snapshot.docs
                    .map((doc) => ({ id: doc.id, ...doc.data() } as Message))
                    .filter((msg) => msg.chatType === activeChat)
            );
        });
        return () => unsub();
    }, [activeChat]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        await addDoc(collection(db, "messages"), {
            chatType: activeChat,
            sender: currentUser.username,
            text: input.trim(),
            timestamp: Date.now(),
        });
        setInput("");
    };

    const renderChatContent = () => (
        <div className="w-full h-full flex flex-col gap-2 overflow-y-auto">
            {messages.length === 0 ? (
                <p className="text-center text-text-secondary">
                    Nessun messaggio ancora nella chat {activeChat === 'tournament' ? 'del campionato' : activeChat === 'group' ? 'del girone' : 'privata'}.
                </p>
            ) : (
                messages.map((msg) => (
                    <div key={msg.id} className={`p-2 rounded-lg ${msg.sender === currentUser.username ? "bg-highlight/20 text-right" : "bg-primary/30 text-left"}`}>
                        <span className="font-bold text-accent">{msg.sender}:</span> {msg.text}
                    </div>
                ))
            )}
        </div>
    );

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
            <div className="flex-grow flex flex-col justify-end p-4 bg-primary/50 rounded-lg">
                {renderChatContent()}
            </div>
            <form onSubmit={sendMessage} className="mt-4 flex gap-2">
                <input
                    type="text"
                    placeholder={`Scrivi un messaggio nella chat ${activeChat}...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-grow bg-primary border border-tertiary rounded-lg p-2 text-text-primary"
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    className="bg-highlight hover:bg-highlight/80 text-white font-bold px-4 py-2 rounded-lg transition-colors"
                >
                    Invia
                </button>
            </form>
        </div>
    );
};

export default ChatPanel;