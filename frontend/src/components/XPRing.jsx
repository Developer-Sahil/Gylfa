export default function XPRing({ xp, nextXp, prevXp, level, size = 180, stroke = 10 }) {
  const total = Math.max(nextXp - prevXp, 1);
  const progress = Math.min(Math.max((xp - prevXp) / total, 0), 1);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  return (
    <div className="relative" style={{ width: size, height: size }} data-testid="xp-ring">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#BAFB00"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            filter: "drop-shadow(0 0 12px rgba(186,251,0,0.55))",
            transition: "stroke-dashoffset 1s ease-in-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono-label text-[10px] text-zinc-400">Lv.</span>
        <span className="font-display text-5xl font-black text-white leading-none">{level}</span>
        <span className="font-mono-label text-[10px] text-[#BAFB00] mt-1">{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
}
