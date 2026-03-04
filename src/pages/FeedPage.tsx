/* C:\HDUD_DATA\hdud-web-app\src\pages\FeedPage.tsx */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";
import {
  buildFeedSnapshot,
  fetchAuthorChapters,
  fetchAuthorMemories,
  type FeedSnapshot,
} from "../services/feed.service";

// ✅ Compat: cobre chaves antigas + chave oficial atual
function getToken(): string | null {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("token")
  );
}

function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getAuthorIdFromToken(token: string | null): number | null {
  if (!token) return null;
  const jwt = parseJwtPayload(token);
  const raw = jwt?.author_id ?? jwt?.authorId ?? jwt?.sub_author_id ?? null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safeDateMs(value: any): number | null {
  if (!value) return null;
  const d1 = new Date(value);
  if (!isNaN(d1.getTime())) return d1.getTime();
  const d2 = new Date(String(value).replace(" ", "T"));
  if (!isNaN(d2.getTime())) return d2.getTime();
  return null;
}

function formatTimeAgoPtBR(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const ms = now.getTime() - d.getTime();
    if (Number.isNaN(ms)) return iso;

    const sec = Math.floor(ms / 1000);
    if (sec < 45) return "agora";

    const min = Math.floor(sec / 60);
    if (min < 60) return `há ${min} min`;

    const hr = Math.floor(min / 60);
    if (hr < 24) return `há ${hr} h`;

    const day = Math.floor(hr / 24);
    if (day === 1) return "ontem";
    if (day < 30) return `há ${day} dias`;

    const mon = Math.floor(day / 30);
    if (mon === 1) return "há 1 mês";
    if (mon < 12) return `há ${mon} meses`;

    const yr = Math.floor(mon / 12);
    if (yr === 1) return "há 1 ano";
    return `há ${yr} anos`;
  } catch {
    return iso;
  }
}

// ---------------------------
// FEED v0.1 (contrato)
// ---------------------------
type FeedV01Actor = {
  author_id: number;
  name_public: string | null;
  avatar_url: string | null;
};

type FeedV01Item = {
  actor: FeedV01Actor;
  kind: "memory" | "chapter" | "version" | string;
  action: "published" | "created" | "updated" | string;
  activity_at: string;
  object: {
    kind: string;
    id: number | string;
    title: string;
    nav: string;
    preview?: string | null;
    meta?: any;
  };
  social?: {
    friendOf?: any;
    people?: any[];
    verb?: string;
    counts?: { likes?: number; comments?: number; reposts?: number; saves?: number };
  };
  score?: number;
};

type FeedV01Response = {
  version: "FEED_v0.1";
  actor: FeedV01Actor;
  items: FeedV01Item[];
  meta?: any;
  legacy?: any;
};

function verbPtBR(action: string) {
  const a = String(action || "").toLowerCase();
  if (a === "published") return "publicou";
  if (a === "created") return "criou";
  if (a === "updated") return "atualizou";
  return "movimentou";
}

function kindPtBR(kind: string) {
  const k = String(kind || "").toLowerCase();
  if (k === "memory") return "Memória";
  if (k === "chapter") return "Capítulo";
  if (k === "version") return "Versão";
  return "Item";
}

function kindIcon(kind: string) {
  const k = String(kind || "").toLowerCase();
  if (k === "chapter") return "📘";
  if (k === "memory") return "📝";
  if (k === "version") return "🧬";
  return "✨";
}

// ---------------------------
// Timeout helper -> força cair no fallback
// ---------------------------
async function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let t: number | null = null;
  const timeout = new Promise<T>((_resolve, reject) => {
    t = window.setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) window.clearTimeout(t);
  }
}

function normalizeScore(it: FeedV01Item): number {
  const s = Number(it?.score);
  if (Number.isFinite(s)) return s;
  const c = it?.social?.counts;
  const likes = Number(c?.likes || 0);
  const comments = Number(c?.comments || 0);
  const reposts = Number(c?.reposts || 0);
  const saves = Number(c?.saves || 0);
  return likes * 1 + comments * 3 + reposts * 4 + saves * 2;
}

function sortRankScoreThenTime(items: FeedV01Item[]): FeedV01Item[] {
  const arr = [...(items || [])];
  arr.sort((a, b) => {
    const as = normalizeScore(a);
    const bs = normalizeScore(b);
    if (bs !== as) return bs - as;

    const am = safeDateMs(a?.activity_at) ?? 0;
    const bm = safeDateMs(b?.activity_at) ?? 0;
    if (bm !== am) return bm - am;

    const at = String(a?.object?.title || "");
    const bt = String(b?.object?.title || "");
    return bt.localeCompare(at);
  });
  return arr;
}

// ---------------------------
// DEV-only debug
// ---------------------------
const DEBUG_FEED = (import.meta as any).env?.VITE_DEBUG_FEED === "1";
function debugFeed(...args: any[]) {
  if (!DEBUG_FEED) return;
  // eslint-disable-next-line no-console
  console.debug("[HDUD][feed]", ...args);
}

function coerceLegacyToV01(r: any, authorIdFallback?: number | null): FeedV01Response | null {
  if (!r || !Array.isArray(r?.items)) return null;

  const actorRaw = r?.actor || r?.profile || r?.me || {};
  const actor: FeedV01Actor = {
    author_id: Number(actorRaw?.author_id || actorRaw?.id || authorIdFallback || 0) || 0,
    name_public: actorRaw?.name_public ?? actorRaw?.name ?? "Autor",
    avatar_url: actorRaw?.avatar_url ?? actorRaw?.avatar ?? null,
  };

  const items: FeedV01Item[] = (r.items as any[]).map((it) => {
    const kind = String(it?.type || it?.kind || "memory");
    const id = it?.source_id ?? it?.id ?? it?.object_id ?? 0;

    const nav =
      it?.meta?.nav ||
      it?.nav ||
      (kind.toLowerCase() === "chapter" ? "/chapters" : `/memories/${id}`);

    const title = it?.title || it?.object?.title || "(sem título)";
    const preview = it?.meta?.preview || it?.meta?.description || it?.object?.preview || null;

    return {
      actor: {
        author_id: Number(it?.meta?.author_id || actor.author_id || authorIdFallback || 0) || 0,
        name_public: it?.meta?.author_name || it?.meta?.author || actor.name_public || "Autor",
        avatar_url: it?.meta?.avatar_url || actor.avatar_url || null,
      },
      kind,
      action: it?.meta?.action || it?.action || "published",
      activity_at: it?.meta?.activity_at || it?.activity_at || it?.date || new Date().toISOString(),
      object: {
        kind,
        id,
        title,
        nav,
        preview,
        meta: it?.meta || it?.object?.meta || {},
      },
      social: it?.social || {},
      score: it?.score,
    };
  });

  return {
    version: "FEED_v0.1",
    actor,
    items,
    meta: r?.meta || { legacy: true },
    legacy: r,
  };
}

/**
 * ✅ Resolve URL de avatar de forma CANÔNICA
 * - absoluta: mantém
 * - "/cdn/...": aponta para API_BASE_URL (4000 em dev), nunca 5173
 */
function toAbsoluteCdnUrl(v: string | null | undefined): string {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^https?:\/\/.+/i.test(s)) return s;

  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "";
  if (s.startsWith("/cdn/")) {
    const base = API_BASE_URL || "http://127.0.0.1:4000";
    return `${base}${s}`;
  }

  if (s.startsWith("/")) {
    if (API_BASE_URL && API_BASE_URL.trim()) return `${API_BASE_URL}${s}`;
    return `${window.location.origin}${s}`;
  }

  return s;
}

// ---------------------------
// UI helpers
// ---------------------------
function initials(name: string) {
  const s = String(name || "").trim();
  if (!s) return "A";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "A";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function clampText(s: string, max = 220) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

type FeedCardModel = {
  key: string;
  who: string;
  avatar_url: string | null;
  verb: string;
  kindLabel: string;
  kindRaw: string;
  title: string;
  preview?: string | null;
  whenLabel: string;
  nav: string;
  score: number;
};

function buildCardFromV01(it: FeedV01Item, idx: number): FeedCardModel {
  const who = it?.actor?.name_public || "Autor";
  const verb = it?.social?.verb || verbPtBR(it?.action);
  const kindLabel = kindPtBR(it?.kind);
  const kindRaw = String(it?.kind || "");
  const title = it?.object?.title || "(sem título)";
  const preview = it?.object?.preview || null;
  const whenLabel = formatTimeAgoPtBR(it?.activity_at);
  const nav = it?.object?.nav || (String(it?.kind).toLowerCase() === "chapter" ? "/chapters" : "/memories");
  const score = normalizeScore(it);

  const idKey = String(it?.object?.id ?? idx);
  const kKey = String(it?.kind || "item");
  const atKey = String(it?.activity_at || "");
  return {
    key: `${kKey}:${idKey}:${atKey}:${idx}`,
    who,
    avatar_url: it?.actor?.avatar_url || null,
    verb,
    kindLabel,
    kindRaw,
    title,
    preview,
    whenLabel,
    nav,
    score,
  };
}

function buildCardFromSnapshot(m: any, idx: number): FeedCardModel {
  const title = m?.title || "(sem título)";
  const whenLabel = formatTimeAgoPtBR(m?.created_at || new Date().toISOString());
  const isEdit = Number(m?.version_number || 1) > 1;
  const verb = isEdit ? "atualizou" : "criou";

  const id = Number(m?.memory_id || m?.id || 0) || m?.id || idx;
  return {
    key: `snapshot:memory:${String(id)}:${String(m?.created_at || idx)}`,
    who: "Autor",
    avatar_url: null,
    verb,
    kindLabel: "Memória",
    kindRaw: "memory",
    title,
    preview: null,
    whenLabel,
    nav: `/memories/${id}`,
    score: 0,
  };
}

function Badge({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "accent" | "soft";
}) {
  const bg =
    tone === "accent"
      ? "var(--hdud-accent-bg)"
      : tone === "soft"
      ? "rgba(255,255,255,0.05)"
      : "rgba(255,255,255,0.03)";

  const border =
    tone === "accent" ? "var(--hdud-accent-border)" : "var(--hdud-border)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        fontSize: 12,
        fontWeight: 850,
        lineHeight: 1,
        color: "var(--hdud-text)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function FeedCard({
  c,
  onOpen,
}: {
  c: FeedCardModel;
  onOpen: (nav: string) => void;
}) {
  const avatarAbs = toAbsoluteCdnUrl(c.avatar_url);
  const showAvatar = !!avatarAbs;
  const icon = kindIcon(c.kindRaw || c.kindLabel);

  const onActivate = () => onOpen(c.nav);

  return (
    <div
      className="hdud-card"
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      style={{
        padding: 14,
        borderRadius: 18,
        cursor: "pointer",
        transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
        boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
        border: "1px solid var(--hdud-border)",
        background: "var(--hdud-surface)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = "0 14px 34px rgba(0,0,0,0.24)";
        el.style.borderColor = "rgba(255,255,255,0.14)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(0px)";
        el.style.boxShadow = "0 10px 28px rgba(0,0,0,0.18)";
        el.style.borderColor = "var(--hdud-border)";
      }}
      title="Abrir"
    >
      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid var(--hdud-border)",
            background: "rgba(255,255,255,0.04)",
            display: "grid",
            placeItems: "center",
          }}
          aria-label="Avatar"
        >
          {showAvatar ? (
            <img
              src={avatarAbs}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>{initials(c.who)}</div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          {/* Header social */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.92, lineHeight: 1.2 }}>
                <span style={{ fontWeight: 1000 }}>{c.who}</span>{" "}
                <span style={{ fontWeight: 850, opacity: 0.78 }}>{c.verb}</span>{" "}
                <span style={{ fontWeight: 950 }}>{c.kindLabel}</span>{" "}
                <span style={{ marginLeft: 6, opacity: 0.85 }}>{icon}</span>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge text={c.whenLabel} tone="soft" />
                <Badge text={c.kindLabel} tone="neutral" />
                {c.score > 0 ? <Badge text={`score ${c.score}`} tone="accent" /> : null}
              </div>
            </div>

            {/* ✅ Removido Abrir → (redundância). Mantemos apenas ações abaixo */}
          </div>

          {/* Conteúdo */}
          <div
            style={{
              marginTop: 12,
              fontSize: 16,
              fontWeight: 1000,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={c.title}
          >
            {c.title}
          </div>

          {c.preview?.trim() ? (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82, lineHeight: 1.35 }}>
              {clampText(c.preview, 220)}
            </div>
          ) : null}

          {/* Ações */}
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="hdud-btn hdud-btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                onActivate();
              }}
              title="Abrir"
            >
              Abrir
            </button>

            <button className="hdud-btn" onClick={(e) => e.stopPropagation()} title="Curtir (MVP: ainda não persiste)">
              Curtir
            </button>

            <button className="hdud-btn" onClick={(e) => e.stopPropagation()} title="Comentar (MVP: ainda não persiste)">
              Comentar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="hdud-card"
      style={{
        padding: 14,
        borderRadius: 18,
        opacity: 0.9,
        boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
        border: "1px solid var(--hdud-border)",
        background: "var(--hdud-surface)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,0.06)" }} />
        <div>
          <div style={{ height: 10, width: "64%", background: "rgba(255,255,255,0.06)", borderRadius: 8 }} />
          <div style={{ marginTop: 10, height: 12, width: "86%", background: "rgba(255,255,255,0.06)", borderRadius: 8 }} />
          <div style={{ marginTop: 10, height: 10, width: "52%", background: "rgba(255,255,255,0.06)", borderRadius: 8 }} />
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <div style={{ height: 32, width: 90, background: "rgba(255,255,255,0.06)", borderRadius: 10 }} />
            <div style={{ height: 32, width: 90, background: "rgba(255,255,255,0.06)", borderRadius: 10 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feedV01, setFeedV01] = useState<FeedV01Response | null>(null);
  const [snapshot, setSnapshot] = useState<FeedSnapshot | null>(null);

  // ♾️ scaffold
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const token = getToken();
  const authorId = getAuthorIdFromToken(token);

  const seqRef = useRef(0);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);

  function openNav(nav: string) {
    const to = String(nav || "").trim();
    if (!to) return;
    navigate(to);
  }

  function computeCursorFromItems(items: FeedV01Item[]): string | null {
    if (!items?.length) return null;
    const last = items[items.length - 1];
    return String(last?.activity_at || "").trim() || null;
  }

  async function load(mode: "replace" | "append") {
    const seq = ++seqRef.current;

    if (mode === "replace") {
      setError(null);
      setHasMore(false);
      setCursor(null);
    }

    const t = getToken();
    if (!t) {
      setFeedV01(null);
      setSnapshot(null);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    if (mode === "replace") setLoading(true);
    else setLoadingMore(true);

    try {
      const qs = new URLSearchParams();
      qs.set("v", "0.1");
      qs.set("limit", "20");
      if (mode === "append" && cursor) qs.set("cursor", cursor);

      const req = apiGet<any>(`/feed?${qs.toString()}`);
      const r = await withTimeout(req, 6500, "Timeout do feed real. Usando fallback.");

      debugFeed("raw response", r);

      if (r?.version === "FEED_v0.1" && Array.isArray(r?.items)) {
        if (seq !== seqRef.current) return;

        // ✅ Aqui já refletimos o MOVE B no front:
        // score DESC, activity_at DESC (enquanto backend não estiver pronto)
        const ranked = sortRankScoreThenTime(r.items || []);

        const nextCursor = (r?.meta?.next_cursor || r?.meta?.cursor_next || null) as any;

        if (mode === "replace") {
          setFeedV01({ ...(r as FeedV01Response), items: ranked });
        } else {
          setFeedV01((prev) => {
            const prevItems = prev?.items || [];
            const merged = sortRankScoreThenTime([...prevItems, ...ranked]);
            return prev ? { ...prev, items: merged } : ({ ...(r as FeedV01Response), items: merged } as FeedV01Response);
          });
        }

        setSnapshot(null);

        const hm =
          typeof r?.meta?.has_more === "boolean"
            ? !!r.meta.has_more
            : typeof r?.meta?.hasMore === "boolean"
            ? !!r.meta.hasMore
            : false;

        setHasMore(hm);
        setCursor(String(nextCursor || computeCursorFromItems(ranked) || "") || null);
        return;
      }

      const coerced = coerceLegacyToV01(r, authorId);
      if (coerced) {
        if (seq !== seqRef.current) return;

        const ranked = sortRankScoreThenTime(coerced.items || []);
        if (mode === "replace") setFeedV01({ ...coerced, items: ranked });
        else {
          setFeedV01((prev) => {
            const prevItems = prev?.items || [];
            const merged = sortRankScoreThenTime([...prevItems, ...ranked]);
            return prev ? { ...prev, items: merged } : ({ ...coerced, items: merged } as FeedV01Response);
          });
        }

        setSnapshot(null);
        setHasMore(false);
        setCursor(computeCursorFromItems(ranked));
        return;
      }

      throw new Error("Resposta do feed inválida (nem v0.1 nem legado compat).");
    } catch (e: any) {
      if (seq !== seqRef.current) return;

      if (mode === "append") {
        setHasMore(false);
        setError(e?.message ?? "Falha ao carregar mais itens.");
        return;
      }

      try {
        const aId = getAuthorIdFromToken(t) ?? authorId;
        if (!aId) throw new Error("Autor não identificado. Faça login novamente.");

        const [memories, chapters] = await Promise.all([
          fetchAuthorMemories(t, aId),
          fetchAuthorChapters(t, aId),
        ]);

        if (seq !== seqRef.current) return;

        const snap = buildFeedSnapshot(memories, chapters.length);
        setSnapshot(snap);
        setFeedV01(null);
        setHasMore(false);
        setCursor(null);

        setError(e?.message ?? "Feed real indisponível. Usando fallback.");
      } catch (e2: any) {
        if (seq !== seqRef.current) return;
        setFeedV01(null);
        setSnapshot(null);
        setHasMore(false);
        setCursor(null);
        setError(e2?.message ?? "Falha ao carregar seu Feed.");
      }
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    void load("replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const rankedItems = useMemo(() => {
    if (!feedV01?.items?.length) return [];
    return sortRankScoreThenTime(feedV01.items);
  }, [feedV01]);

  const headerName = useMemo(() => {
    const n = String(feedV01?.actor?.name_public || "").trim();
    return n || "Autor";
  }, [feedV01]);

  const storyCounts = useMemo(() => {
    const c1 = feedV01?.meta?.summary?.counts;
    if (c1 && (typeof c1.memories === "number" || typeof c1.chapters === "number")) {
      return { memories: Number(c1.memories || 0), chapters: Number(c1.chapters || 0) };
    }

    if (rankedItems.length) {
      const m = rankedItems.filter((x) => String(x.kind).toLowerCase() === "memory").length;
      const c = rankedItems.filter((x) => String(x.kind).toLowerCase() === "chapter").length;
      return { memories: m, chapters: c };
    }

    if (snapshot) {
      const m = snapshot.counts.memoriesTotal ?? 0;
      const c = snapshot.counts.chaptersTotal ?? 0;
      return { memories: m, chapters: c };
    }

    return { memories: 0, chapters: 0 };
  }, [feedV01, rankedItems, snapshot]);

  const hintMode = useMemo(() => {
    if (loading) return "Atualizando…";
    if (!token) return "Entre para ver";
    if (feedV01) return feedV01?.legacy ? "Real (API legacy→v0.1)" : "Real (API v0.1)";
    if (snapshot) return "Fallback (seed)";
    return "Em breve";
  }, [loading, token, feedV01, snapshot]);

  const cards: FeedCardModel[] | null = useMemo(() => {
    if (!token) return null;

    if (rankedItems.length) {
      return rankedItems.map((it, idx) => buildCardFromV01(it, idx));
    }

    if (snapshot?.recentMemories?.length) {
      return snapshot.recentMemories.map((m: any, idx: number) => buildCardFromSnapshot(m, idx));
    }

    return [];
  }, [token, rankedItems, snapshot]);

  // ---------------------------
  // Scroll container + infinite scaffold
  // ---------------------------
  function onFeedScroll() {
    const el = feedScrollRef.current;
    if (!el) return;
    if (loading || loadingMore) return;
    if (!hasMore) return;

    const thresholdPx = 520;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < thresholdPx) void load("append");
  }

  useEffect(() => {
    const el = feedScrollRef.current;
    if (!el) return;

    const handler = () => onFeedScroll();
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, cursor]);

  // ---------------------------
  // Layout (Sidebar | Feed | Insights)
  // ---------------------------
  const layoutStyle: React.CSSProperties = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: "320px minmax(520px, 1fr) 340px",
      gap: 14,
      alignItems: "start",
      maxWidth: 1400,
      margin: "0 auto",
    }),
    []
  );

  const cardShellStyle: React.CSSProperties = useMemo(
    () => ({
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      borderRadius: 18,
      padding: 14,
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
    }),
    []
  );

  const sectionTitleStyle: React.CSSProperties = useMemo(
    () => ({
      fontWeight: 950,
      letterSpacing: "-0.02em",
      fontSize: 14,
      marginBottom: 10,
    }),
    []
  );

  return (
    <div className="hdud-page" style={{ minHeight: "calc(100vh - 52px)" }}>
      {/* HERO */}
      <div
        className="hdud-card"
        style={{
          padding: 16,
          borderRadius: 18,
          boxShadow: "0 12px 36px rgba(0,0,0,0.22)",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 1000, letterSpacing: "-0.03em" }}>
              Feed — o presente narrativo
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.78 }}>
              O que está vivo agora na sua história.{" "}
              <span style={{ opacity: 0.9, fontWeight: 900 }}>{hintMode}</span>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Badge text={headerName} tone="neutral" />
              <Badge text={`${storyCounts.memories} memórias`} tone="soft" />
              <Badge text={`${storyCounts.chapters} capítulos`} tone="soft" />
              {authorId ? <Badge text={`id ${authorId}`} tone="neutral" /> : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {!token ? (
              <button className="hdud-btn hdud-btn-primary" onClick={() => navigate("/login")} title="Entrar">
                Entrar
              </button>
            ) : (
              <button
                className="hdud-btn"
                onClick={() => {
                  if (loading) return;
                  void load("replace");
                }}
                disabled={loading}
                title="Atualizar"
              >
                {loading ? "Atualizando…" : "Atualizar"}
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div className="hdud-alert hdud-alert-warn" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 4 }}>
              {feedV01 ? "Aviso" : "Não consegui abrir seu Feed real"}
            </div>
            <div style={{ opacity: 0.88 }}>{error}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="hdud-btn hdud-btn-primary" onClick={() => void load("replace")} disabled={loading}>
                Tentar novamente
              </button>
              <button className="hdud-btn" onClick={() => navigate("/dashboard")}>
                Ir para Dashboard
              </button>
            </div>
          </div>
        ) : null}

        {!token ? (
          <div className="hdud-alert hdud-alert-warn" style={{ marginTop: 14 }}>
            Você ainda não entrou. Faça login para ver seu “presente narrativo”.
          </div>
        ) : null}
      </div>

      {/* 3 COLUNAS — Social Layout */}
      <div style={layoutStyle}>
        {/* LEFT */}
        <aside style={{ position: "sticky", top: 70, alignSelf: "start" }}>
          <div style={cardShellStyle}>
            <div style={sectionTitleStyle}>Criar</div>

            <div style={{ display: "grid", gap: 10 }}>
              <button className="hdud-btn hdud-btn-primary" onClick={() => navigate("/memories")} title="Memórias">
                Memória →
              </button>
              <button className="hdud-btn" onClick={() => navigate("/chapters")} title="Capítulos">
                Capítulo →
              </button>
              <button className="hdud-btn" onClick={() => navigate("/timeline")} title="Timeline">
                Timeline →
              </button>
            </div>

            <div style={{ marginTop: 14, borderTop: "1px solid var(--hdud-border)", paddingTop: 12 }}>
              <div style={{ fontWeight: 950, fontSize: 13 }}>Modo</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge text={hintMode} tone={snapshot ? "soft" : "accent"} />
                <Badge text="LinkedIn-like" tone="neutral" />
                <Badge text="score + tempo" tone="neutral" />
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78, lineHeight: 1.35 }}>
                Aqui a história “acontece” em tempo real. O ranking definitivo entra no backend no MOVE B.
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER — Scroll Container */}
        <section style={{ minWidth: 0 }}>
          <div style={{ borderRadius: 18, border: "1px solid var(--hdud-border)", background: "transparent" }}>
            <div
              ref={feedScrollRef}
              style={{
                maxHeight: "calc(100vh - 52px - 18px - 24px)",
                overflowY: "auto",
                paddingRight: 6,
                paddingBottom: 8,
                scrollBehavior: "smooth",
              }}
            >
              <div style={{ display: "grid", gap: 12 }}>
                {loading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : cards === null ? (
                  <div className="hdud-muted-sm">Entre para ver seu feed.</div>
                ) : cards.length === 0 ? (
                  <div className="hdud-card" style={{ padding: 14, borderRadius: 18 }}>
                    <div style={{ fontWeight: 950, marginBottom: 6 }}>Seu feed ainda está quieto…</div>
                    <div style={{ opacity: 0.8, fontSize: 13, lineHeight: 1.35 }}>
                      Crie/edite uma memória ou capítulo para o feed ganhar vida.
                    </div>
                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="hdud-btn hdud-btn-primary" onClick={() => navigate("/memories")}>
                        Ir para Memórias
                      </button>
                      <button className="hdud-btn" onClick={() => navigate("/chapters")}>
                        Ir para Capítulos
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {cards.map((c) => (
                      <FeedCard key={c.key} c={c} onOpen={openNav} />
                    ))}

                    {hasMore ? (
                      <div className="hdud-card" style={{ padding: 14, borderRadius: 18 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ fontWeight: 950 }}>Carregando mais…</div>
                          <button className="hdud-btn" disabled={loadingMore} onClick={() => void load("append")}>
                            {loadingMore ? "…" : "Carregar mais"}
                          </button>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                          Infinite scroll scaffold ok. Cursor/hasMore real entra quando o backend expor isso.
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "8px 0", opacity: 0.7, fontSize: 12 }}>
                        fim do feed (por enquanto)
                      </div>
                    )}

                    {loadingMore ? <SkeletonCard /> : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT */}
        <aside style={{ position: "sticky", top: 70, alignSelf: "start" }}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={cardShellStyle}>
              <div style={sectionTitleStyle}>Insights</div>

              <div style={{ display: "grid", gap: 10 }}>
                <div className="hdud-card" style={{ padding: 12, borderRadius: 16, boxShadow: "0 10px 26px rgba(0,0,0,0.16)" }}>
                  <div style={{ fontWeight: 950, fontSize: 13 }}>Sua jornada</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Badge text={`${storyCounts.memories} memórias`} tone="soft" />
                    <Badge text={`${storyCounts.chapters} capítulos`} tone="soft" />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78, lineHeight: 1.35 }}>
                    Ranking: score DESC, tempo DESC (MOVE B).
                  </div>
                </div>

                <div className="hdud-card" style={{ padding: 12, borderRadius: 16, boxShadow: "0 10px 26px rgba(0,0,0,0.16)" }}>
                  <div style={{ fontWeight: 950, fontSize: 13 }}>Engajamento</div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
                    Curtir/Comentar já estão na UI — persistência entra no MOVE C.
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Badge text="MOVE C" tone="accent" />
                    <Badge text="likes/comments" tone="neutral" />
                  </div>
                </div>

                <div className="hdud-card" style={{ padding: 12, borderRadius: 16, boxShadow: "0 10px 26px rgba(0,0,0,0.16)" }}>
                  <div style={{ fontWeight: 950, fontSize: 13 }}>Rede</div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
                    Hoje: feed pessoal. MOVE D entra /feed/home, /feed/network, /feed/global.
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Badge text="MOVE D" tone="accent" />
                    <Badge text="network/global" tone="neutral" />
                  </div>
                </div>
              </div>
            </div>

            {DEBUG_FEED ? (
              <div style={cardShellStyle}>
                <div style={sectionTitleStyle}>Debug</div>
                <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                  token: <b>{token ? "ok" : "null"}</b>
                  <br />
                  authorId: <b>{authorId ?? "null"}</b>
                  <br />
                  hasMore: <b>{String(hasMore)}</b>
                  <br />
                  cursor: <b>{cursor ?? "null"}</b>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}