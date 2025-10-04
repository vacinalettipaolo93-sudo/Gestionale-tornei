import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

// playerData deve avere almeno: name, phone, avatar (aggiungi altri campi se vuoi)
export async function addPlayerAndUser(playerData: { name: string; phone: string; avatar: string; }) {
  // 1. Crea il giocatore
  const playerRef = await addDoc(collection(db, "players"), {
    name: playerData.name,
    phone: playerData.phone,
    avatar: playerData.avatar,
    status: "pending"
  });

  // 2. Crea l'utente Firestore collegato
  await addDoc(collection(db, "users"), {
    username: playerData.name, // "Nome Cognome"
    password: "1234",          // password default
    role: "participant",
    playerId: playerRef.id     // collega utente e giocatore
  });
}