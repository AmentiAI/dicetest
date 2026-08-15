export function EmoteHolo({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  return (
    <div className={`emote-holo emote-${id}`} aria-hidden>
      <div className="emote-beam" />
      <div className="emote-icon">
        {id === "hot-streak" ? "♛" : null}
        {id === "bad-beat" ? "⬡" : null}
        {id === "locked-in" ? "◉" : null}
        {id === "laughing-skull" ? "☠" : null}
        {id === "fist-bump" ? "⚡" : null}
        {id === "gg" ? "GG" : null}
      </div>
      <div className="emote-pad" />
      <span>{label}</span>
    </div>
  );
}
