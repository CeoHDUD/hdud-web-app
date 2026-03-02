// C:\HDUD_DATA\hdud-web-app\src\components\LivingEcosystem.tsx

import React, { useMemo } from "react";

export type LivingStory = {
  id: string;
  authorName: string;
  title: string;
  fragment: string;
  href?: string;
};

type Props = {
  title?: string;
  subtitle?: string;
  items?: LivingStory[];
  onOpen?: (href: string) => void;
  variant?: "raw" | "card";
};

function clamp(s: string, max = 140) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

/**
 * LivingEcosystem — Epicentro Vivo (v1.3)
 * - Destaque token-first (sem rgba hardcoded)
 * - Grid orgânico (auto-fit + minmax)
 * - Acessível (tab/enter/space)
 */
export default function LivingEcosystem(props: Props) {
  const items = Array.isArray(props.items) ? props.items : [];
  const canOpen = typeof props.onOpen === "function";

  const variant = props.variant ?? "raw";
  const title = (props.title ?? "").trim();
  const subtitle = (props.subtitle ?? "").trim();
  const showHeader = !!title || !!subtitle;

  const wrapStyle: React.CSSProperties =
    variant === "card"
      ? { padding: 16, border: "1px solid var(--hdud-border)", borderRadius: 14, background: "var(--hdud-surface)" }
      : { padding: 0, border: "none", borderRadius: 0, background: "transparent" };

  const emptyStyle: React.CSSProperties = {
    border: "1px dashed rgba(0,0,0,0.14)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(0,0,0,0.02)",
  };

  const cardStyleBase: React.CSSProperties = {
    border: "1px solid var(--hdud-border)",
    borderRadius: 14,
    background: "var(--hdud-surface)",
    padding: 14,
    minHeight: 0,
    cursor: "default",
    transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
    outline: "none",
  };

  const shown = useMemo(() => items.slice(0, 14), [items]);

  return (
    <div style={wrapStyle}>
      {showHeader ? (
        <div style={{ marginBottom: 12 }}>
          {title ? <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 6 }}>{title}</div> : null}
          {subtitle ? (
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 750, lineHeight: 1.35 }}>{subtitle}</div>
          ) : null}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <div style={emptyStyle}>
          <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 6 }}>Ainda está silencioso por aqui</div>
          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 750, lineHeight: 1.35 }}>
            Quando existirem memórias reais, elas aparecem aqui misturadas com histórias-semente.
          </div>
        </div>
      ) : (
        <div
          className="hdud-ecos-grid-fix"
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            alignItems: "stretch",
          }}
        >
          {shown.map((it, idx) => {
            const clickable = !!it.href && canOpen;
            const isFeatured = idx === 0;

            return (
              <div
                key={it.id}
                className={isFeatured ? "hdud-ecos-card hdud-ecos-featured" : "hdud-ecos-card"}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : -1}
                onClick={() => {
                  if (!clickable) return;
                  props.onOpen?.(it.href as string);
                }}
                onKeyDown={(e) => {
                  if (!clickable) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    props.onOpen?.(it.href as string);
                  }
                }}
                title={clickable ? "Abrir" : undefined}
                style={{
                  ...cardStyleBase,
                  cursor: clickable ? "pointer" : "default",
                  background: isFeatured
                    ? `radial-gradient(900px 420px at 22% 18%,
                        color-mix(in srgb, var(--hdud-warn-bg) 82%, transparent) 0%,
                        transparent 64%),
                      linear-gradient(180deg, var(--hdud-surface), var(--hdud-surface-2))`
                    : "var(--hdud-surface)",
                  borderColor: isFeatured ? "var(--hdud-warn-border)" : "var(--hdud-border)",
                  boxShadow: isFeatured ? "var(--hdud-shadow-2)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!clickable) return;
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(-1px)";
                  el.style.boxShadow = "var(--hdud-shadow-2)";
                  el.style.borderColor = "color-mix(in srgb, var(--hdud-border) 100%, transparent)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = isFeatured ? "var(--hdud-shadow-2)" : "none";
                  el.style.borderColor = isFeatured ? "var(--hdud-warn-border)" : "var(--hdud-border)";
                }}
                onFocus={(e) => {
                  if (!clickable) return;
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--hdud-warn-bg) 35%, transparent)";
                }}
                onBlur={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = isFeatured ? "var(--hdud-shadow-2)" : "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.76, minWidth: 0 }}>
                    {clamp(it.authorName, 56)}
                  </div>

                  {clickable ? (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 950,
                        opacity: 0.72,
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "color-mix(in srgb, var(--hdud-surface-2) 78%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--hdud-border) 70%, transparent)",
                        userSelect: "none",
                      }}
                    >
                      Abrir →
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: isFeatured ? 18 : 14,
                    fontWeight: 950,
                    lineHeight: 1.15,
                    letterSpacing: isFeatured ? -0.3 : 0,
                  }}
                >
                  {clamp(it.title, isFeatured ? 120 : 96)}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    opacity: 0.82,
                    fontWeight: 750,
                    lineHeight: 1.55,
                  }}
                >
                  {clamp(it.fragment, isFeatured ? 240 : 170)}
                </div>

                {isFeatured ? (
                  <>
                    <div style={{ marginTop: 12, height: 1, background: "color-mix(in srgb, var(--hdud-border) 70%, transparent)" }} />
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.72, fontWeight: 850 }}>
                      Destaque do momento — o epicentro está vivo.
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 920px) {
          .hdud-page-dashboard .hdud-ecos-grid-fix { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 1100px) {
          .hdud-page-dashboard .hdud-ecos-featured { grid-column: span 2; }
        }
      `}</style>
    </div>
  );
}