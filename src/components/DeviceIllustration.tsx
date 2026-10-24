import * as React from "react";

/**
 * Schlichte, eigene Strichillustrationen je Gerätekategorie.
 * Bewusst schematisch – keine Nachbildung realer Cybex-Produktfotos.
 */

const Stack = ({ x = 124 }: { x?: number }) => (
  <g>
    <rect x={x} y={14} width={24} height={92} rx={2} />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
      <line key={i} x1={x + 3} x2={x + 21} y1={60 + i * 5.5} y2={60 + i * 5.5} />
    ))}
    <line x1={x + 12} x2={x + 12} y1={20} y2={58} strokeDasharray="2 3" />
  </g>
);

const Floor = () => <line x1={6} x2={154} y1={110} y2={110} />;

const Seat = ({ x, y, w = 30 }: { x: number; y: number; w?: number }) => (
  <g>
    <rect x={x} y={y} width={w} height={7} rx={3} />
    <line x1={x + w / 2} x2={x + w / 2} y1={y + 7} y2={110} />
  </g>
);

const Arrow = ({ d }: { d: string }) => <path d={d} markerEnd="url(#arrow)" strokeDasharray="3 3" />;

const drawings: Record<string, React.ReactNode> = {
  "chest-press": (
    <>
      <Floor />
      <Stack />
      <Seat x={30} y={78} />
      <rect x={28} y={30} width={8} height={48} rx={3} transform="rotate(-8 32 54)" />
      <path d="M40 52 H92 M92 42 V62" />
      <path d="M92 52 L110 40 L124 40" />
      <Arrow d="M60 40 H86" />
    </>
  ),
  "pec-fly": (
    <>
      <Floor />
      <Stack />
      <Seat x={40} y={80} />
      <rect x={52} y={30} width={8} height={50} rx={3} />
      <path d="M56 36 Q30 40 22 62" />
      <path d="M56 36 Q86 40 94 62" />
      <rect x={16} y={56} width={8} height={18} rx={3} />
      <rect x={92} y={56} width={8} height={18} rx={3} />
      <Arrow d="M30 74 Q56 92 82 74" />
    </>
  ),
  "rear-delt": (
    <>
      <Floor />
      <Stack />
      <Seat x={40} y={80} />
      <rect x={60} y={34} width={9} height={40} rx={3} />
      <path d="M58 40 L28 40 M58 40 L96 40" />
      <circle cx={26} cy={40} r={4} />
      <circle cx={98} cy={40} r={4} />
      <Arrow d="M44 28 H18" />
      <Arrow d="M76 28 H104" />
    </>
  ),
  "lat-pulldown": (
    <>
      <Floor />
      <Stack />
      <path d="M110 110 V12 H40" />
      <line x1={46} x2={46} y1={12} y2={36} />
      <path d="M22 40 Q46 32 70 40" />
      <Seat x={34} y={84} />
      <rect x={34} y={66} width={24} height={6} rx={3} />
      <Arrow d="M84 30 V60" />
    </>
  ),
  row: (
    <>
      <Floor />
      <Stack />
      <Seat x={20} y={84} />
      <rect x={58} y={46} width={8} height={40} rx={3} />
      <path d="M66 56 H96 M96 48 V64" />
      <path d="M96 56 L124 56" strokeDasharray="2 3" />
      <Arrow d="M90 72 H62" />
    </>
  ),
  "shoulder-press": (
    <>
      <Floor />
      <Stack />
      <Seat x={34} y={84} />
      <rect x={42} y={36} width={8} height={48} rx={3} />
      <path d="M50 46 L70 46 L70 22" />
      <path d="M62 22 H78" />
      <path d="M78 22 L104 22 L124 30" strokeDasharray="2 3" />
      <Arrow d="M88 50 V18" />
    </>
  ),
  biceps: (
    <>
      <Floor />
      <Stack />
      <Seat x={24} y={86} />
      <path d="M44 62 L84 50 L86 58 L46 70 Z" />
      <line x1={70} x2={70} y1={66} y2={110} />
      <path d="M84 50 Q104 46 100 24" />
      <path d="M94 24 H106" />
      <Arrow d="M110 48 Q114 30 104 18" />
    </>
  ),
  triceps: (
    <>
      <Floor />
      <Stack />
      <Seat x={26} y={86} />
      <rect x={30} y={40} width={8} height={46} rx={3} />
      <path d="M48 40 L84 40 L84 60" />
      <path d="M76 60 H92" />
      <Arrow d="M100 36 V70" />
    </>
  ),
  abdominal: (
    <>
      <Floor />
      <Stack />
      <Seat x={30} y={86} />
      <rect x={32} y={42} width={8} height={44} rx={3} />
      <path d="M40 46 Q66 38 76 58" />
      <rect x={70} y={56} width={14} height={7} rx={3} />
      <Arrow d="M88 44 Q96 66 82 80" />
    </>
  ),
  "leg-press-stack": (
    <>
      <Floor />
      <Stack />
      <path d="M14 96 L44 70" />
      <rect x={18} y={92} width={34} height={7} rx={3} />
      <path d="M44 70 L96 36" />
      <rect x={90} y={22} width={8} height={34} rx={2} transform="rotate(-33 94 39)" />
      <line x1={30} x2={30} y1={99} y2={110} />
      <Arrow d="M64 70 L92 52" />
    </>
  ),
  "leg-press-plates": (
    <>
      <Floor />
      <path d="M10 98 L40 74" />
      <rect x={14} y={94} width={34} height={7} rx={3} />
      <path d="M24 108 L140 30" />
      <rect x={92} y={34} width={8} height={30} rx={2} transform="rotate(-34 96 49)" />
      <line x1={108} x2={128} y1={52} y2={66} />
      <circle cx={128} cy={66} r={14} />
      <circle cx={128} cy={66} r={9} />
      <circle cx={128} cy={66} r={2} />
      <line x1={30} x2={30} y1={101} y2={110} />
      <Arrow d="M54 78 L82 60" />
    </>
  ),
  "leg-extension": (
    <>
      <Floor />
      <Stack />
      <Seat x={28} y={64} w={34} />
      <rect x={26} y={24} width={8} height={40} rx={3} />
      <path d="M62 68 L72 68 L72 96" />
      <circle cx={72} cy={98} r={5} />
      <Arrow d="M84 98 Q96 84 92 64" />
    </>
  ),
  "leg-curl": (
    <>
      <Floor />
      <Stack />
      <rect x={14} y={70} width={78} height={7} rx={3} />
      <line x1={30} x2={30} y1={77} y2={110} />
      <line x1={78} x2={78} y1={77} y2={110} />
      <path d="M92 74 L104 74 L104 62" />
      <circle cx={104} cy={58} r={5} />
      <Arrow d="M110 72 Q116 52 100 42" />
    </>
  ),
  "hip-add-abd": (
    <>
      <Floor />
      <Stack />
      {/* Frontansicht: Sitz, Rückenlehne, zwei Beinpolster */}
      <rect x={44} y={30} width={36} height={40} rx={4} />
      <rect x={38} y={70} width={48} height={8} rx={3} />
      <line x1={62} x2={62} y1={78} y2={110} />
      <rect x={36} y={74} width={7} height={24} rx={3} />
      <rect x={81} y={74} width={7} height={24} rx={3} />
    </>
  ),
  // Adduktoren: Beine gegen Widerstand ZUSAMMEN – Pfeile zeigen zur Mitte
  "hip-adduction": (
    <>
      <Floor />
      <Stack />
      {/* Frontansicht: Sitz, Rückenlehne, zwei Beinpolster */}
      <rect x={44} y={30} width={36} height={40} rx={4} />
      <rect x={38} y={70} width={48} height={8} rx={3} />
      <line x1={62} x2={62} y1={78} y2={110} />
      <rect x={30} y={74} width={7} height={24} rx={3} />
      <rect x={87} y={74} width={7} height={24} rx={3} />
      <Arrow d="M10 86 H26" />
      <Arrow d="M114 86 H98" />
    </>
  ),
  // Abduktoren: Beine gegen Widerstand AUSEINANDER – Pfeile zeigen nach aussen
  "hip-abduction": (
    <>
      <Floor />
      <Stack />
      {/* Frontansicht: Sitz, Rückenlehne, zwei Beinpolster */}
      <rect x={44} y={30} width={36} height={40} rx={4} />
      <rect x={38} y={70} width={48} height={8} rx={3} />
      <line x1={62} x2={62} y1={78} y2={110} />
      <rect x={48} y={74} width={7} height={24} rx={3} />
      <rect x={69} y={74} width={7} height={24} rx={3} />
      <Arrow d="M44 86 H18" />
      <Arrow d="M80 86 H106" />
    </>
  ),
  calf: (
    <>
      <Floor />
      <Stack />
      <rect x={34} y={98} width={36} height={8} rx={2} />
      <path d="M40 98 L40 86 L64 86" />
      <path d="M44 22 H86 M86 22 V34" />
      <rect x={42} y={26} width={18} height={7} rx={3} />
      <rect x={66} y={26} width={18} height={7} rx={3} />
      <line x1={110} x2={86} y1={26} y2={26} />
      <Arrow d="M100 92 V70" />
    </>
  ),
  "generic-stack": (
    <>
      <Floor />
      <Stack />
      <Seat x={40} y={80} />
      <rect x={42} y={36} width={8} height={44} rx={3} />
    </>
  ),
  "generic-plates": (
    <>
      <Floor />
      <rect x={30} y={80} width={40} height={7} rx={3} />
      <line x1={50} x2={50} y1={87} y2={110} />
      <circle cx={112} cy={72} r={18} />
      <circle cx={112} cy={72} r={11} />
      <line x1={70} x2={112} y1={72} y2={72} />
    </>
  ),
};

export function DeviceIllustration({
  illustrationKey,
  className,
  title,
}: {
  illustrationKey?: string;
  className?: string;
  title?: string;
}) {
  const drawing = drawings[illustrationKey ?? ""] ?? drawings["generic-stack"];
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      role="img"
      aria-label={title ? `Illustration: ${title}` : "Geräte-Illustration"}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" stroke="none" />
        </marker>
      </defs>
      {drawing}
    </svg>
  );
}

export const ILLUSTRATION_KEYS = Object.keys(drawings);
