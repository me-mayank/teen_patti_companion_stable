export default function WinCelebration() {
  return <div className="win-celebration" aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ '--confetti-x': `${(i * 37) % 100}%`, '--confetti-delay': `${(i % 8) * .12}s`, '--confetti-color': ['#ffe2a0', '#dc574b', '#5dc8a2', '#fff3d5'][i % 4], '--confetti-spin': `${i % 2 ? 600 : -600}deg` }} />)}</div>;
}
