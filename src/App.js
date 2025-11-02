import Tornei from "./components/Tornei";
import Risultati from "./components/Risultati";
import Utenti from "./components/Utenti";
import Impostazioni from "./components/Impostazioni";

export default function App() {
  return (
    <div style={{ fontFamily: "sans-serif", margin: "0 auto", maxWidth: 600 }}>
      <h1>Gestionale Tornei</h1>
      <Impostazioni />
      <Tornei />
      <Risultati />
      <Utenti />
    </div>
  );
}