import { useState } from 'react';
import anaya from '../../../assets/table/dealer-anaya-standing.png';
import tara from '../../../assets/table/dealer-tara-standing.png';

const dealers = [
  { id: 'anaya', name: 'Anaya', image: anaya },
  { id: 'tara', name: 'Tara', image: tara },
];
const preferenceKey = 'teen-patti-dealer';

function savedDealer() {
  try {
    const saved = window.localStorage.getItem(preferenceKey);
    return dealers.find(dealer => dealer.id === saved) || dealers[0];
  } catch { return dealers[0]; }
}

export default function Dealer() {
  const [selected, setSelected] = useState(savedDealer);
  const choose = dealer => {
    setSelected(dealer);
    try { window.localStorage.setItem(preferenceKey, dealer.id); }
    catch { /* The dealer still switches when browser storage is unavailable. */ }
  };

  return <section className="table-dealer" aria-label="Table dealer">
    <img className="dealer-portrait" src={selected.image} alt={`${selected.name}, your table dealer`} width="1536" height="1024" />
    <div className="dealer-details">
      <div className="dealer-heading"><strong>{selected.name}</strong><span>Your dealer</span></div>
      <div className="dealer-picker" role="group" aria-label="Choose your dealer">
        {dealers.map(dealer => <button key={dealer.id} type="button" className="dealer-option" aria-pressed={selected.id === dealer.id} onClick={() => choose(dealer)}>{dealer.name}</button>)}
      </div>
    </div>
  </section>;
}
