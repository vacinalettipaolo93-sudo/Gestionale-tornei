import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";

export default function Risultati() {
  const [risultati, setRisultati] = useState([]);
  const [nome, setNome] = useState("");
  const [punteggio, setPunteggio] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editPunteggio, setEditPunteggio] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "risultati"), snapshot => {
      setRisultati(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    });
    return () => unsub();
  }, []);

  async function aggiungiRisultato(e) {
    e.preventDefault();
    if (!nome.trim() || !punteggio.trim()) return;
    await addDoc(collection(db, "risultati"), {
      nome: nome.trim(),
      punteggio: punteggio.trim()
    });
    setNome("");
    setPunteggio("");
  }

  async function eliminaRisultato(id) {
    await deleteDoc(doc(db, "risultati", id));
  }

  async function modificaRisultato(e) {
    e.preventDefault();
    if (!editNome.trim() || !editPunteggio.trim()) return;
    await updateDoc(doc(db, "risultati", editId), {
      nome: editNome.trim(),
      punteggio: editPunteggio.trim()
    });
    setEditId(null);
    setEditNome("");
    setEditPunteggio("");
  }

  return (
    <div>
      <h3>Risultati</h3>
      <form onSubmit={aggiungiRisultato}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" />
        <input value={punteggio} onChange={e => setPunteggio(e.target.value)} placeholder="Punteggio" />
        <button type="submit">Aggiungi</button>
      </form>
      <ul>
        {risultati.map(res => (
          <li key={res.id}>
            {editId === res.id ? (
              <form onSubmit={modificaRisultato} style={{ display: "inline" }}>
                <input value={editNome} onChange={e => setEditNome(e.target.value)} />
                <input value={editPunteggio} onChange={e => setEditPunteggio(e.target.value)} />
                <button type="submit">Salva</button>
                <button type="button" onClick={() => setEditId(null)}>Annulla</button>
              </form>
            ) : (
              <>
                {res.nome} - {res.punteggio}
                <button onClick={() => { setEditId(res.id); setEditNome(res.nome); setEditPunteggio(res.punteggio); }}>Modifica</button>
                <button onClick={() => eliminaRisultato(res.id)}>Elimina</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}