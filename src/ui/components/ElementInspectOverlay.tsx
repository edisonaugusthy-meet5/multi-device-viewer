import { Check, Copy, Lock, MousePointer2 } from "lucide-react";
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";

export interface InspectData {
  tagName: string;
  id: string;
  classes: string[];
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
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
  width: number;
  height: number;
  display: string;
  position: string;
  borderRadius: string;
  opacity: string;
  zIndex: string;
  boxShadow: string;
  x: number;
  y: number;
  rect: { top: number; left: number; width: number; height: number };
}

interface ElementInspectOverlayProps {
  data: InspectData | null;
  locked: boolean;
  // scale / iframeRef still accepted (highlight box is now imperative in PreviewCard)
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

  // Position the tooltip relative to the hovered element's visual bounds.
  // Runs after paint so offsetWidth/Height are accurate.
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

  const hasShadow = data.boxShadow && data.boxShadow !== "none";

  return (
    <div
      ref={tooltipRef}
      className={`absolute z-50 w-[260px] overflow-hidden rounded-xl border shadow-2xl ${
        dark
          ? "border-white/15 bg-[#1a1f2e]"
          : "border-slate-200/80 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.16)]"
      }`}
      style={{ left: tooltipPos.left, top: tooltipPos.top }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${dark ? "border-white/10 bg-white/[0.03]" : "border-slate-100 bg-slate-50/80"}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <MousePointer2 size={11} className={`shrink-0 ${dark ? "text-blue-400" : "text-blue-500"}`} />
          <span className={`min-w-0 truncate font-mono text-[11px] font-bold ${dark ? "text-slate-100" : "text-slate-900"}`}>
            {data.tagName.toLowerCase()}
            {data.id && <span className={dark ? "text-blue-300" : "text-blue-600"}>#{data.id}</span>}
          </span>
        </div>
        {locked && (
          <span className="flex shrink-0 items-center gap-1 rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5">
            <Lock size={9} className="text-amber-400" />
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-300">locked</span>
          </span>
        )}
      </div>

      <div className="max-h-[min(320px,50vh)] space-y-3 overflow-y-auto p-3">
        {/* Size */}
        <Section label="Size" dark={dark}>
          <p className={`font-mono text-[11px] font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>
            {Math.round(data.width)} × {Math.round(data.height)}
          </p>
        </Section>

        {/* Colors */}
        <Section label="Colors" dark={dark}>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className={`w-6 shrink-0 text-right text-[10px] font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>text</span>
              <ColorSwatch hex={data.colorHex || data.color} dark={dark} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-6 shrink-0 text-right text-[10px] font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>bg</span>
              <ColorSwatch hex={data.backgroundColorHex || data.backgroundColor} dark={dark} />
            </div>
          </div>
        </Section>

        {/* Typography */}
        <Section label="Typography" dark={dark}>
          <div className="space-y-0.5">
            <p className="truncate font-mono text-[10px]" title={data.fontFamily}>
              <span className={`font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>family </span>
              <span className={dark ? "text-slate-200" : "text-slate-700"}>{data.fontFamily}</span>
            </p>
            <Row label="size  " value={data.fontSize} dark={dark} />
            <Row label="weight" value={data.fontWeight} dark={dark} />
            <Row label="lh    " value={data.lineHeight} dark={dark} />
          </div>
        </Section>

        {/* Spacing */}
        <Section label="Spacing" dark={dark}>
          <Row
            label="pad"
            value={
              data.paddingTop === data.paddingRight &&
              data.paddingTop === data.paddingBottom &&
              data.paddingTop === data.paddingLeft
                ? data.paddingTop
                : `${data.paddingTop} ${data.paddingRight} ${data.paddingBottom} ${data.paddingLeft}`
            }
            dark={dark}
          />
          <Row
            label="mar"
            value={
              data.marginTop === data.marginRight &&
              data.marginTop === data.marginBottom &&
              data.marginTop === data.marginLeft
                ? data.marginTop
                : `${data.marginTop} ${data.marginRight} ${data.marginBottom} ${data.marginLeft}`
            }
            dark={dark}
          />
        </Section>

        {/* Layout */}
        <Section label="Layout" dark={dark}>
          <div className="space-y-0.5">
            <Row label="display " value={data.display} dark={dark} />
            <Row label="position" value={data.position} dark={dark} />
            {data.borderRadius !== "0px" && <Row label="radius  " value={data.borderRadius} dark={dark} />}
            {data.opacity !== "1" && <Row label="opacity " value={data.opacity} dark={dark} />}
            {data.zIndex !== "auto" && <Row label="z-index " value={data.zIndex} dark={dark} />}
            {hasShadow && (
              <Row
                label="shadow  "
                value={data.boxShadow.length > 32 ? `${data.boxShadow.slice(0, 32)}…` : data.boxShadow}
                dark={dark}
              />
            )}
          </div>
        </Section>

        {/* Classes — at the bottom */}
        {data.classes.length > 0 && (
          <Section label="Classes" dark={dark}>
            <div className="flex flex-wrap gap-1">
              {data.classes.map((cls) => (
                <CopyableChip key={cls} value={`.${cls}`} dark={dark} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
