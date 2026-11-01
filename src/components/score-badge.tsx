/** Your private score. 9+ gets the warm terracotta highlight, like the reference. */
export function ScoreBadge({ score, label = "You" }: { score: number; label?: string }) {
  return (
    <div
      className={`min-w-[52px] rounded-[10px] px-2 py-1.5 text-center leading-tight ${
        score >= 9 ? "bg-terracotta text-paper" : "bg-plum text-sand"
      }`}
    >
      <b className="block font-serif text-xl font-semibold">{score}</b>
      <small className="text-[10px] tracking-[0.06em] uppercase">{label}</small>
    </div>
  );
}
