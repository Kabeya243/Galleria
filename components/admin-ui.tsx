// Shared admin presentational pieces (Nov 2026): moved verbatim from the
// old single admin page so every admin page renders exactly the same
// cards. Server components, no client code.

// Small sparkline from real daily counts — pure SVG, no chart library.
// Colours come from the admin theme variables, so it follows dark/light.
export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 140;
  const h = 36;
  const points = values.map((v, i) => {
    const x = values.length > 1 ? (i * (w - 4)) / (values.length - 1) + 2 : w / 2;
    const y = h - 3 - (v / max) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  return (
    <svg className="ad-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon
        points={`2,${h} ${line} ${w - 2},${h}`}
        style={{ fill: "var(--ad-spark-fill)" }}
      />
      <polyline
        points={line}
        fill="none"
        style={{ stroke: "var(--ad-spark-stroke)" }}
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function EmptyBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="ad-empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

// Ranked share bars (same look as "Users by country"): the top entries
// with their share of the largest one.
export function ShareBars({ items, max }: { items: Array<{ name: string; count: number }>; max: number }) {
  return (
    <ul className="ad-share ad-scroll">
      {items.map((item) => (
        <li key={item.name}>
          <div className="ad-share-row">
            <span className="ad-share-name">{item.name}</span>
            <span className="ad-share-count">{item.count}</span>
          </div>
          <div className="ad-share-track">
            <div
              className="ad-share-fill"
              style={{ width: `${Math.max((item.count / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
