import { Coins } from 'lucide-react';
export default function PotArea({ potAmount, currentBet }) {
  return <div className="pot-area"><div className="chip-stack" aria-hidden="true"><i /><i /><i /><Coins size={24} /></div><span>Table pot</span><strong>₹{(potAmount || 0).toLocaleString('en-IN')}</strong><small>Blind stake · ₹{(currentBet || 0).toLocaleString('en-IN')}</small></div>;
}
