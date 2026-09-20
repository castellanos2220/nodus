/**
 * Ilustración de marca: una red de nodos en gris con un único recorrido
 * resaltado en turquesa — un caso que atraviesa el ecosistema hasta su cierre.
 * Decorativa: `aria-hidden`, sin texto.
 */
const NODES: Array<[number, number]> = [
  [40, 60],
  [150, 30],
  [260, 90],
  [380, 50],
  [470, 130],
  [90, 170],
  [210, 200],
  [330, 180],
  [440, 250],
  [50, 290],
  [170, 310],
  [290, 290],
  [400, 350],
  [120, 400],
  [250, 410],
  [360, 440],
  [470, 400],
];

const EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [1, 6],
  [2, 6],
  [2, 7],
  [3, 7],
  [4, 8],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [6, 10],
  [7, 11],
  [8, 12],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [10, 14],
  [11, 14],
  [12, 15],
  [13, 14],
  [14, 15],
  [15, 16],
  [12, 16],
];

/** Recorrido resaltado, por índice de nodo. */
const PATH = [0, 5, 6, 7, 11, 14, 15, 16];

export function NodeField({ className }: { className?: string }) {
  const highlighted = new Set(PATH.slice(1).map((node, index) => `${PATH[index]}-${node}`));

  return (
    <svg viewBox="0 0 510 470" className={className} aria-hidden fill="none">
      {EDGES.map(([a, b]) => {
        const [x1, y1] = NODES[a]!;
        const [x2, y2] = NODES[b]!;
        const on = highlighted.has(`${a}-${b}`) || highlighted.has(`${b}-${a}`);
        return (
          <line
            key={`${a}-${b}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeWidth={on ? 1.75 : 1}
            className={on ? 'stroke-brand' : 'stroke-border-strong'}
          />
        );
      })}
      {NODES.map(([x, y], index) => {
        const onPath = PATH.includes(index);
        const last = index === PATH[PATH.length - 1];
        return (
          <g key={index}>
            {last && <circle cx={x} cy={y} r={14} className="fill-brand/15" />}
            <circle
              cx={x}
              cy={y}
              r={last ? 7 : onPath ? 5 : 4}
              strokeWidth={1.5}
              className={
                last
                  ? 'fill-brand stroke-brand'
                  : onPath
                    ? 'fill-card stroke-foreground'
                    : 'fill-card stroke-border-strong'
              }
            />
          </g>
        );
      })}
    </svg>
  );
}
