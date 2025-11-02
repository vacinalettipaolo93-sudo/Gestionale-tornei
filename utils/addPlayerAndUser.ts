import { db } from "../firebase";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";

// Passa l'oggetto event come parametro!
export async function addPlayerAndUser(event: any, playerData: { name: string; phone: string; avatar: string; }) {
  // 1. Crea il giocatore globale (in "players" collection)
  const playerRef = await addDoc(collection(db, "players"), {
    name: playerData.name,
    phone: playerData.phone,
    avatar: playerData.avatar,
    status: "confirmed"
  });

  // 2. Crea l'utente Firestore collegato (in "users" collection)
  await addDoc(collection(db, "users"), {
    username: playerData.name, // "Nome Cognome"
    password: "1234",          // password default
    role: "participant",
    playerId: playerRef.id     // collega utente e giocatore
  });

  // 3. Aggiungi il player all'evento (usa id creato da Firestore!)
  const newPlayer = {
    id: playerRef.id,
    name: playerData.name,
    phone: playerData.phone,
    avatar: playerData.avatar,
    status: "confirmed"
  };

  const updatedPlayers = [...event.players, newPlayer];
  await updateDoc(doc(db, "events", event.id), { players: updatedPlayers });
}