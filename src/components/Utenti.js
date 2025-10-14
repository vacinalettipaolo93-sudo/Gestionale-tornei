import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";

export default function Utenti() {
  const [utenti, setUtenti] = useState([]);
  const [nome, setNome] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "utenti"), snapshot => {
      setUtenti(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    });
    return () => unsub();
  }, []);

  async function aggiungiUtente(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    await addDoc(collection(db, "utenti"), { nome: nome.trim() });
    setNome("");
  }

  async function eliminaUtente(id) {
    await deleteDoc(doc(db, "utenti", id));
  }

  async function modificaUtente(e) {
    e.preventDefault();
    if (!editNome.trim()) return;
    await updateDoc(doc(db, "utenti", editId), { nome: editNome.trim() });
    setEditId(null);
    setEditNome("");
  }

  return (
    <div>
      <h3>Utenti</h3>
      <form onSubmit={aggiungiUtente}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome utente" />
        <button type="submit">Aggiungi</button>
      </form>
      <ul>
        {utenti
          .slice()
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map(utente => (
          <li key={utente.id}>
            {editId === utente.id ? (
              <form onSubmit={modificaUtente} style={{ display: "inline" }}>
                <input value={editNome} onChange={e => setEditNome(e.target.value)} />
                <button type="submit">Salva</button>
                <button type="button" onClick={() => setEditId(null)}>Annulla</button>
              </form>
            ) : (
              <>
                {utente.nome}
                <button onClick={() => { setEditId(utente.id); setEditNome(utente.nome); }}>Modifica</button>
                <button onClick={() => eliminaUtente(utente.id)}>Elimina</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
