import { Check, Copy, Lock, MousePointer2 } from "lucide-react";
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";

// Guard against undefined/null values arriving from the content-script postMessage.
// TypeScript types say string/number, but at runtime fields can be missing.
const ss = (v: unknown, fallback = "—"): string =>
  v != null && v !== "" ? String(v) : fallback;
const sn = (v: unknown, fallback = 0): number =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;

export interface InspectData {
  tagName: string;
  id: string;
  classes: string[];
  breadcrumb: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  color: string;
  colorHex: string;
  backgroundColor: string;
  backgroundColorHex: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  borderWidth: string;
  borderColor: string;
  borderColorHex: string;
  width: number;
  height: number;
  display: string;
  position: string;
  overflow: string;
  overflowX: string;
  overflowY: string;
  transform: string;
  borderRadius: string;
  opacity: string;
  zIndex: string;
  boxShadow: string;
  // Flex container
  isFlexContainer: boolean;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  gap: string;
  // Grid container
  isGridContainer: boolean;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  // Flex item
  isInFlex: boolean;
  flexGrow: string;
  flexShrink: string;
  flexBasis: string;
  alignSelf: string;
  // Grid item
  isInGrid: boolean;
  gridColumn: string;
  gridRow: string;
  // CSS snippet
  cssSnippet: string;
  x: number;
  y: number;
  rect: { top: number; left: number; width: number; height: number };
}

interface ElementInspectOverlayProps {
  data: InspectData | null;
  locked: boolean;
  scale: number;
  dark: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

// ── small helpers ─────────────────────────────────────────────────────────────

function ColorSwatch({ hex, dark }: { hex: string; dark: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(hex); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [hex]);

  return (
    <button type="button" onClick={copy} title={`Copy ${hex}`}
      className="flex items-center gap-1.5 rounded px-1 py-0.5 transition hover:opacity-80">
      <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-black/10"
        style={{ backgroundColor: hex }} />
      <span className={`font-mono text-[11px] font-medium ${dark ? "text-slate-300" : "text-slate-700"}`}>{hex}</span>
      {copied
        ? <Check size={10} className="text-teal-400" strokeWidth={3} />
        : <Copy size={10} className={dark ? "text-slate-500" : "text-slate-400"} />}
    </button>
  );
}

function CopyableChip({ value, dark }: { value: string; dark: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [value]);

  return (
    <button type="button" onClick={copy} title={`Copy ${value}`}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold transition ${
        copied
          ? "border-teal-400/50 bg-teal-400/10 text-teal-300"
          : dark
            ? "border-white/15 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
      }`}>
      {value}
      {copied
        ? <Check size={9} strokeWidth={3} className="text-teal-400" />
        : <Copy size={9} className="opacity-40" />}
    </button>
  );
}

function CopyableBlock({ value, dark, label }: { value: string; dark: boolean; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <div className={`rounded-lg border ${dark ? "border-white/10 bg-white/[0.04]" : "border-slate-100 bg-slate-50"}`}>
      <div className={`flex items-center justify-between border-b px-2 py-1 ${dark ? "border-white/10" : "border-slate-100"}`}>
        <span className={`text-[9px] font-black uppercase tracking-widest ${dark ? "text-slate-500" : "text-slate-400"}`}>{label}</span>
        <button type="button" onClick={copy}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold transition ${
            copied
              ? "text-teal-400"
              : dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
          }`}>
          {copied ? <Check size={9} strokeWidth={3} /> : <Copy size={9} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={`overflow-x-auto whitespace-pre-wrap break-all px-2 py-1.5 font-mono text-[9px] leading-relaxed ${dark ? "text-slate-300" : "text-slate-700"}`}>{value}</pre>
    </div>
  );
}

function Row({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <p className="font-mono text-[10px]">
      <span className={`font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>{label} </span>
      <span className={dark ? "text-slate-200" : "text-slate-700"}>{value}</span>
    </p>
  );
}

function Section({ label, children, dark }: { label: string; children: ReactNode; dark: boolean }) {
  return (
    <div className="space-y-1">
      <p className={`text-[9px] font-black uppercase tracking-widest ${dark ? "text-slate-600" : "text-slate-400"}`}>{label}</p>
      <div>{children}</div>
    </div>
  );
}

/**
 * Box model diagram — flat absolute-positioned layout.
 *
 * Renders four concentric coloured bands (margin/border/padding/content)
 * using a single positioned container with absolutely-placed value labels.
 * No nested divs — eliminates all sizing collapse issues.
 *
 * Layout (fixed 240 × 148 px canvas):
 *
 *   ┌─── margin ────────────────────────────────┐
 *   │           marginTop                        │
 *   │  ┌─── border ──────────────────────────┐  │
 *   │  │          borderWidth                 │  │
 *   │  │  ┌─── padding ──────────────────┐   │  │
 *   │  │  │        paddingTop             │   │  │
 *   │L │L │  ┌──────────────────────┐  R │ R │R │
 *   │  │  │  │  W × H  (content)    │    │   │  │
 *   │  │  │  └──────────────────────┘    │   │  │
 *   │  │  │        paddingBottom          │   │  │
 *   │  │  └──────────────────────────────┘   │  │
 *   │  │          borderWidth                 │  │
 *   │  └─────────────────────────────────────┘  │
 *   │           marginBottom                     │
 *   └────────────────────────────────────────────┘
 */
function BoxModelDiagram({ data, dark }: { data: InspectData; dark: boolean }) {
  // Strip "px" suffix, treat "0px" as "0"
  const v = (raw: unknown): string => {
    const str = ss(raw, "0px");
    return str === "0px" ? "0" : str.replace(/px$/, "");
  };

  const d = {
    mT: v(data.marginTop),    mR: v(data.marginRight),
    mB: v(data.marginBottom), mL: v(data.marginLeft),
    bW: v(data.borderWidth),
    pT: v(data.paddingTop),   pR: v(data.paddingRight),
    pB: v(data.paddingBottom),pL: v(data.paddingLeft),
    w:  Math.round(sn(data.width)),
    h:  Math.round(sn(data.height)),
  };

  // Band colours — outermost to innermost
  const col = dark
    ? { margin: "#2d2410", border: "#2a1d0e", padding: "#0e2118", content: "#0e1a2e" }
    : { margin: "#fef9ee", border: "#fff7ed", padding: "#f0fdf4", content: "#eff6ff" };

  const txt = dark
    ? { margin: "#fbbf24", border: "#fb923c", padding: "#4ade80", content: "#60a5fa", label: "#64748b" }
    : { margin: "#92400e", border: "#9a3412", padding: "#166534", content: "#1e40af", label: "#94a3b8" };

  // Absolute positions for the four bands (as % of 240×148)
  // margin: full canvas, border: inset 18px, padding: inset 36px, content: inset 54px
  const bands = [
    { key: "margin",  x: 0,  y: 0,  w: 240, h: 148, fill: col.margin,  stroke: txt.margin  },
    { key: "border",  x: 18, y: 18, w: 204, h: 112, fill: col.border,  stroke: txt.border  },
    { key: "padding", x: 36, y: 36, w: 168, h: 76,  fill: col.padding, stroke: txt.padding },
    { key: "content", x: 54, y: 54, w: 132, h: 40,  fill: col.content, stroke: txt.content },
  ];

  // Label positions: [x, y, value, color, anchor]
  type Anchor = "middle" | "start" | "end";
  const labels: Array<[number, number, string, string, Anchor]> = [
    // margin
    [120, 11,  d.mT, txt.margin,  "middle"],
    [120, 141, d.mB, txt.margin,  "middle"],
    [6,   74,  d.mL, txt.margin,  "middle"],
    [234, 74,  d.mR, txt.margin,  "middle"],
    // border
    [120, 28,  d.bW, txt.border,  "middle"],
    [120, 125, d.bW, txt.border,  "middle"],
    [24,  74,  d.bW, txt.border,  "middle"],
    [216, 74,  d.bW, txt.border,  "middle"],
    // padding
    [120, 45,  d.pT, txt.padding, "middle"],
    [120, 108, d.pB, txt.padding, "middle"],
    [43,  74,  d.pL, txt.padding, "middle"],
    [197, 74,  d.pR, txt.padding, "middle"],
    // layer labels (top-left of each band)
    [4,   16,  "margin",  txt.label, "start"],
    [22,  34,  "border",  txt.label, "start"],
    [40,  52,  "padding", txt.label, "start"],
  ];

  return (
    <div className={`overflow-hidden rounded-lg border ${dark ? "border-white/10" : "border-slate-200"}`}>
      {/* SVG diagram */}
      <div className={dark ? "bg-[#0f1117]" : "bg-white"}>
        <svg
          viewBox="0 0 240 148"
          width="100%"
          style={{ display: "block", aspectRatio: "240/148" }}
          aria-label="Box model diagram"
        >
          {/* Bands — draw outermost first so inner ones paint on top */}
          {bands.map(({ key, x, y, w, h, fill, stroke }) => (
            <rect
              key={key}
              x={x} y={y} width={w} height={h}
              fill={fill}
              stroke={stroke}
              strokeWidth={1}
              strokeOpacity={0.35}
              rx={3}
            />
          ))}

          {/* Content label: W × H */}
          <text
            x={120} y={78}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fontWeight={700}
            fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace"
            fill={txt.content}
          >
            {d.w} × {d.h}
          </text>

          {/* Value + layer labels */}
          {labels.map(([x, y, val, color, anchor], i) => (
            <text
              key={i}
              x={x} y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={8.5}
              fontWeight={val === "margin" || val === "border" || val === "padding" ? 900 : 600}
              fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace"
              fill={color}
              opacity={val === "margin" || val === "border" || val === "padding" ? 0.45 : 1}
              letterSpacing={val === "margin" || val === "border" || val === "padding" ? 0.5 : 0}
            >
              {val}
            </text>
          ))}
        </svg>
      </div>

      {/* Summary row: m / p / b shorthand */}
      <div className={`border-t px-2.5 py-1.5 ${dark ? "border-white/10 bg-white/[0.03]" : "border-slate-100 bg-slate-50"}`}>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          {[
            { label: "margin",  color: txt.margin,  value: `${d.mT} ${d.mR} ${d.mB} ${d.mL}` },
            { label: "padding", color: txt.padding, value: `${d.pT} ${d.pR} ${d.pB} ${d.pL}` },
            { label: "border",  color: txt.border,  value: d.bW },
          ].map(({ label, color, value }) => (
            <span key={label} className="flex items-baseline gap-1 font-mono text-[9px]">
              <span style={{ color }} className="font-black">{label[0]}:</span>
              <span className={dark ? "text-slate-300" : "text-slate-600"}>{value}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tooltip panel — only re-renders when element changes ─────────────────────

export function ElementInspectOverlay({
  data,
  locked,
  dark,
  containerRef,
  iframeRef,
  scale,
}: ElementInspectOverlayProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number }>({ left: 16, top: 16 });

  useLayoutEffect(() => {
    if (!data || !tooltipRef.current || !containerRef.current || !iframeRef.current) return;

    const cr = containerRef.current.getBoundingClientRect();
    const ir = iframeRef.current.getBoundingClientRect();
    const ox = ir.left - cr.left;
    const oy = ir.top  - cr.top;

    const left0  = ox + data.rect.left   * scale;
    const top0   = oy + data.rect.top    * scale;
    const width0 = data.rect.width  * scale;

    const containerW = containerRef.current.offsetWidth;
    const containerH = containerRef.current.offsetHeight;
    const ttW = tooltipRef.current.offsetWidth;
    const ttH = tooltipRef.current.offsetHeight;
    const GAP = 10;
    const PAD = 6;

    let left = left0 + width0 + GAP;
    if (left + ttW > containerW - PAD) left = left0 - ttW - GAP;
    left = Math.max(PAD, Math.min(left, containerW - ttW - PAD));

    let top = top0;
    if (top + ttH > containerH - PAD) top = containerH - ttH - PAD;
    top = Math.max(PAD, top);

    setTooltipPos({ left, top });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return null;

  const hasShadow = !!data.boxShadow && data.boxShadow !== "none";
  const hasOverflow =
    ss(data.overflow, "visible") !== "visible" ||
    ss(data.overflowX, "visible") !== "visible" ||
    ss(data.overflowY, "visible") !== "visible";
  const hasTransform = !!data.transform && data.transform !== "";
  const showFlex = !!data.isFlexContainer;
  const showGrid = !!data.isGridContainer;
  const showFlexItem = !!data.isInFlex;
  const showGridItem = !!data.isInGrid;

  return (
    <div
      ref={tooltipRef}
      className={`absolute z-50 w-[280px] overflow-hidden rounded-xl border shadow-2xl ${
        dark
          ? "border-white/15 bg-[#1a1f2e]"
          : "border-slate-200/80 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.16)]"
      }`}
      style={{ left: tooltipPos.left, top: tooltipPos.top }}
    >
      {/* Header */}
      <div className={`flex items-start justify-between gap-2 border-b px-3 py-2 ${dark ? "border-white/10 bg-white/[0.03]" : "border-slate-100 bg-slate-50/80"}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <MousePointer2 size={11} className={`shrink-0 ${dark ? "text-blue-400" : "text-blue-500"}`} />
            <span className={`min-w-0 truncate font-mono text-[11px] font-bold ${dark ? "text-slate-100" : "text-slate-900"}`}>
              {ss(data.tagName, "?").toLowerCase()}
              {data.id && <span className={dark ? "text-blue-300" : "text-blue-600"}>#{data.id}</span>}
            </span>
          </div>
          {data.breadcrumb && (
            <p className={`mt-0.5 truncate font-mono text-[9px] ${dark ? "text-slate-600" : "text-slate-400"}`} title={data.breadcrumb}>
              {data.breadcrumb}
            </p>
          )}
        </div>
        {locked && (
          <span className="flex shrink-0 items-center gap-1 rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5">
            <Lock size={9} className="text-amber-400" />
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-300">locked</span>
          </span>
        )}
      </div>

      <div className="max-h-[min(460px,62vh)] space-y-3 overflow-y-auto p-3">

        {/* ── 1. Size (quick glance) ── */}
        <div className={`flex items-baseline gap-2 rounded-lg border px-3 py-2 ${dark ? "border-white/10 bg-white/[0.03]" : "border-slate-100 bg-slate-50"}`}>
          <span className={`text-[9px] font-black uppercase tracking-widest ${dark ? "text-slate-500" : "text-slate-400"}`}>size</span>
          <span className={`font-mono text-[13px] font-bold ${dark ? "text-slate-100" : "text-slate-900"}`}>
            {Math.round(sn(data.width))} × {Math.round(sn(data.height))}
          </span>
          <span className={`ml-auto text-[10px] font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>{ss(data.display)}</span>
        </div>

        {/* ── 2. Colors ── */}
        <Section label="Colors" dark={dark}>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className={`w-6 shrink-0 text-right text-[10px] font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>text</span>
              <ColorSwatch hex={ss(data.colorHex || data.color, "#000000")} dark={dark} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-6 shrink-0 text-right text-[10px] font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>bg</span>
              <ColorSwatch hex={ss(data.backgroundColorHex || data.backgroundColor, "#ffffff")} dark={dark} />
            </div>
            {data.borderColorHex && ss(data.borderWidth, "0px") !== "0px" && (
              <div className="flex items-center gap-1.5">
                <span className={`w-6 shrink-0 text-right text-[10px] font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>bdr</span>
                <ColorSwatch hex={ss(data.borderColorHex)} dark={dark} />
              </div>
            )}
          </div>
        </Section>

        {/* ── 3. Typography ── */}
        <Section label="Typography" dark={dark}>
          <div className="space-y-0.5">
            <p className="truncate font-mono text-[10px]" title={ss(data.fontFamily)}>
              <span className={`font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>family </span>
              <span className={dark ? "text-slate-200" : "text-slate-700"}>{ss(data.fontFamily)}</span>
            </p>
            <Row label="size  " value={ss(data.fontSize)} dark={dark} />
            <Row label="weight" value={ss(data.fontWeight)} dark={dark} />
            <Row label="lh    " value={ss(data.lineHeight)} dark={dark} />
            {data.letterSpacing && data.letterSpacing !== "normal" && <Row label="ls    " value={ss(data.letterSpacing)} dark={dark} />}
            {data.textAlign && data.textAlign !== "start" && <Row label="align " value={ss(data.textAlign)} dark={dark} />}
          </div>
        </Section>

        {/* ── 4. Layout (position, radius, z-index, overflow, transform) ── */}
        <Section label="Layout" dark={dark}>
          <div className="space-y-0.5">
            <Row label="position" value={ss(data.position)} dark={dark} />
            {ss(data.borderRadius, "0px") !== "0px" && <Row label="radius  " value={ss(data.borderRadius)} dark={dark} />}
            {ss(data.opacity, "1") !== "1" && <Row label="opacity " value={ss(data.opacity)} dark={dark} />}
            {ss(data.zIndex, "auto") !== "auto" && <Row label="z-index " value={ss(data.zIndex)} dark={dark} />}
            {hasShadow && (
              <Row
                label="shadow  "
                value={data.boxShadow.length > 32 ? `${data.boxShadow.slice(0, 32)}…` : data.boxShadow}
                dark={dark}
              />
            )}
            {hasOverflow && <Row label="overflow" value={data.overflow !== data.overflowX ? `x:${ss(data.overflowX)} y:${ss(data.overflowY)}` : ss(data.overflow)} dark={dark} />}
            {hasTransform && <Row label="transform" value={data.transform.length > 36 ? `${data.transform.slice(0, 36)}…` : data.transform} dark={dark} />}
          </div>
        </Section>

        {/* ── 5. Flex / Grid ── */}
        {showFlex && (
          <Section label="Flex (container)" dark={dark}>
            <div className="space-y-0.5">
              <Row label="direction" value={ss(data.flexDirection)} dark={dark} />
              {ss(data.flexWrap) !== "nowrap" && <Row label="wrap     " value={ss(data.flexWrap)} dark={dark} />}
              <Row label="justify  " value={ss(data.justifyContent)} dark={dark} />
              <Row label="align    " value={ss(data.alignItems)} dark={dark} />
              {data.gap && ss(data.gap) !== "0px" && <Row label="gap      " value={ss(data.gap)} dark={dark} />}
            </div>
          </Section>
        )}
        {showGrid && (
          <Section label="Grid (container)" dark={dark}>
            <div className="space-y-0.5">
              {data.gridTemplateColumns && <Row label="columns" value={ss(data.gridTemplateColumns).length > 30 ? `${ss(data.gridTemplateColumns).slice(0, 30)}…` : ss(data.gridTemplateColumns)} dark={dark} />}
              {data.gridTemplateRows && <Row label="rows   " value={ss(data.gridTemplateRows).length > 30 ? `${ss(data.gridTemplateRows).slice(0, 30)}…` : ss(data.gridTemplateRows)} dark={dark} />}
              {data.gap && ss(data.gap) !== "0px" && <Row label="gap    " value={ss(data.gap)} dark={dark} />}
            </div>
          </Section>
        )}
        {showFlexItem && !showFlex && (
          <Section label="Flex (item)" dark={dark}>
            <div className="space-y-0.5">
              {ss(data.flexGrow) !== "0" && <Row label="grow  " value={ss(data.flexGrow)} dark={dark} />}
              {ss(data.flexShrink) !== "1" && <Row label="shrink" value={ss(data.flexShrink)} dark={dark} />}
              {ss(data.flexBasis) !== "auto" && <Row label="basis " value={ss(data.flexBasis)} dark={dark} />}
              {ss(data.alignSelf) !== "auto" && <Row label="self  " value={ss(data.alignSelf)} dark={dark} />}
            </div>
          </Section>
        )}
        {showGridItem && !showGrid && (
          <Section label="Grid (item)" dark={dark}>
            <div className="space-y-0.5">
              {data.gridColumn && ss(data.gridColumn) !== "auto" && <Row label="col" value={ss(data.gridColumn)} dark={dark} />}
              {data.gridRow && ss(data.gridRow) !== "auto" && <Row label="row" value={ss(data.gridRow)} dark={dark} />}
              {data.alignSelf && ss(data.alignSelf) !== "auto" && <Row label="self" value={ss(data.alignSelf)} dark={dark} />}
            </div>
          </Section>
        )}

        {/* ── 6. Box model diagram (middle) ── */}
        <Section label="Box model" dark={dark}>
          <BoxModelDiagram data={data} dark={dark} />
        </Section>

        {/* ── 7. Classes ── */}
        {data.classes.length > 0 && (
          <Section label="Classes" dark={dark}>
            <div className="flex flex-wrap gap-1">
              {data.classes.map((cls) => (
                <CopyableChip key={cls} value={`.${cls}`} dark={dark} />
              ))}
            </div>
          </Section>
        )}

        {/* ── 8. Copy as CSS ── */}
        {data.cssSnippet && (
          <Section label="Copy as CSS" dark={dark}>
            <CopyableBlock label="CSS snippet" value={data.cssSnippet} dark={dark} />
          </Section>
        )}
      </div>
    </div>
  );
}
