import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";

export default function Tornei() {
  const [tornei, setTornei] = useState([]);
  const [nome, setNome] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tornei"), snapshot => {
      setTornei(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    });
    return () => unsub();
  }, []);

  async function aggiungiTorneo(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    await addDoc(collection(db, "tornei"), { nome: nome.trim() });
    setNome("");
  }

  async function eliminaTorneo(id) {
    await deleteDoc(doc(db, "tornei", id));
  }

  async function modificaTorneo(e) {
    e.preventDefault();
    if (!editNome.trim()) return;
    await updateDoc(doc(db, "tornei", editId), { nome: editNome.trim() });
    setEditId(null);
    setEditNome("");
  }

  return (
    <div>
      <h3>Tornei</h3>
      <form onSubmit={aggiungiTorneo}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome torneo" />
        <button type="submit">Aggiungi</button>
      </form>
      <ul>
        {tornei.map(torneo => (
          <li key={torneo.id}>
            {editId === torneo.id ? (
              <form onSubmit={modificaTorneo} style={{ display: "inline" }}>
                <input value={editNome} onChange={e => setEditNome(e.target.value)} />
                <button type="submit">Salva</button>
                <button type="button" onClick={() => setEditId(null)}>Annulla</button>
              </form>
            ) : (
              <>
                {torneo.nome}
                <button onClick={() => { setEditId(torneo.id); setEditNome(torneo.nome); }}>Modifica</button>
                <button onClick={() => eliminaTorneo(torneo.id)}>Elimina</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}