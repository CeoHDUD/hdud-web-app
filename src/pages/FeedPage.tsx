import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

type FeedV01Actor = {
  author_id: number;
  name_public: string | null;
  avatar_url: string | null;
};

type FeedV01Social = {
  friendOf?: any;
  people?: any[];
  verb?: string;
  counts?: { likes?: number; comments?: number; reposts?: number; saves?: number };
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
  social?: FeedV01Social;
  score?: number;
};

type FeedV01Response = {
  version: string;
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

function sortTimeThenScore(items: FeedV01Item[]): FeedV01Item[] {
  const arr = [...(items || [])];
  arr.sort((a, b) => {
    const am = safeDateMs(a?.activity_at) ?? 0;
    const bm = safeDateMs(b?.activity_at) ?? 0;
    if (bm !== am) return bm - am;

    const as = normalizeScore(a);
    const bs = normalizeScore(b);
    if (bs !== as) return bs - as;

    const at = String(a?.object?.title || "");
    const bt = String(b?.object?.title || "");
    return bt.localeCompare(at);
  });
  return arr;
}

const DEBUG_FEED = (import.meta as any).env?.VITE_DEBUG_FEED === "1";
function debugFeed(...args: any[]) {
  if (!DEBUG_FEED) return;
  console.debug("[HDUD][feed]", ...args);
}

function isV01Version(v: any): boolean {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return false;
  if (!s.includes("feed")) return false;
  return s.includes("0.1");
}

function pickItemsArray(r: any): any[] | null {
  if (!r) return null;
  if (Array.isArray(r?.items)) return r.items;
  if (Array.isArray(r?.data?.items)) return r.data.items;
  if (Array.isArray(r?.payload?.items)) return r.payload.items;
  if (Array.isArray(r?.legacy?.items)) return r.legacy.items;
  return null;
}

function coerceLegacyToV01(r: any, authorIdFallback?: number | null): FeedV01Response | null {
  const itemsArr = pickItemsArray(r);
  if (!itemsArr || !Array.isArray(itemsArr)) return null;

  const actorRaw = r?.actor || r?.profile || r?.me || {};
  const actor: FeedV01Actor = {
    author_id: Number(actorRaw?.author_id || actorRaw?.id || authorIdFallback || 0) || 0,
    name_public: actorRaw?.name_public ?? actorRaw?.name ?? "Autor",
    avatar_url: actorRaw?.avatar_url ?? actorRaw?.avatar ?? null,
  };

  const items: FeedV01Item[] = (itemsArr as any[]).map((it) => {
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

function isViteDev(): boolean {
  try {
    return typeof window !== "undefined" && String(window.location?.port || "") === "5173";
  } catch {
    return false;
  }
}

function getDirectFeedBase(): string {
  const env = (import.meta as any).env || {};
  const explicit = String(env.VITE_FEED_DIRECT_BASE || env.VITE_API_BASE_URL || "").trim();

  if (explicit) {
    return explicit.endsWith("/") ? explicit.slice(0, -1) : explicit;
  }

  if (isViteDev()) return "http://127.0.0.1:4000";

  return "/api";
}

function buildDirectFeedUrl(qs: URLSearchParams): string {
  return `${getDirectFeedBase()}/feed?${qs.toString()}`;
}

async function fetchFeedDirect(qs: URLSearchParams, token: string): Promise<any> {
  const url = buildDirectFeedUrl(qs);

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();

  if (/<!doctype html/i.test(text) || /<html/i.test(text)) {
    throw new Error(`Feed respondeu HTML em vez de JSON. URL: ${url}`);
  }

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Feed respondeu payload não-JSON. URL: ${url}`);
  }

  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);
  }

  return data;
}

function toAbsoluteCdnUrl(v: string | null | undefined): string {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^https?:\/\/.+/i.test(s)) return s;

  const CDN_BASE_URL = String((import.meta as any).env?.VITE_CDN_BASE_URL || "").trim();
  const API_BASE_URL = String((import.meta as any).env?.VITE_API_BASE_URL || "").trim();

  const origin = window.location.origin;
  const isDev = isViteDev();

  const baseForCdn = CDN_BASE_URL || (isDev ? API_BASE_URL || "http://127.0.0.1:4000" : origin);

  if (s.startsWith("/cdn/")) return `${baseForCdn}${s}`;

  if (s.startsWith("/")) {
    if (API_BASE_URL) return `${API_BASE_URL}${s}`;
    return `${origin}${s}`;
  }

  return s;
}

function initials(name: string) {
  const t = String(name || "").trim();
  if (!t) return "A";
  const parts = t.split(/\s+/).filter(Boolean);
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

function getEnergyTag(it: FeedV01Item): { emoji: string; text: string } | null {
  const kind = String(it?.kind || "").toLowerCase();
  const action = String(it?.action || "").toLowerCase();

  if (kind === "chapter" && action === "published") return { emoji: "📘", text: "Capítulo publicado" };
  if (kind === "chapter" && action === "created") return { emoji: "✍️", text: "Novo capítulo" };
  if (kind === "memory" && action === "updated") return { emoji: "🔄", text: "Memória atualizada" };
  if (kind === "memory" && action === "created") return { emoji: "🧠", text: "Nova memória" };
  if (kind === "version") return { emoji: "🧬", text: "Nova versão" };
  return { emoji: "⭐", text: "Sua história continua…" };
}

function isRecentActivity(whenLabel: string) {
  return whenLabel === "agora" || whenLabel.includes("min") || whenLabel.includes(" h");
}

function formatSocialVoice(social?: FeedV01Social): string | null {
  if (!social) return null;
  const counts = social.counts || {};
  const likes = Number(counts.likes || 0);
  const comments = Number(counts.comments || 0);
  const reposts = Number(counts.reposts || 0);
  const saves = Number(counts.saves || 0);

  const people = Array.isArray(social.people) ? social.people : [];
  const names = people
    .map((p: any) => String(p?.name || p?.full_name || p?.name_public || "").trim())
    .filter(Boolean);

  const first = names[0] || null;

  if (reposts > 0) {
    const who = first || "Alguém";
    const rest = Math.max(0, reposts - 1);
    if (rest > 0) return `${who} repostou · +${rest}`;
    return `${who} repostou`;
  }

  if (comments > 0) {
    const who = first || "Alguém";
    const rest = Math.max(0, comments - 1);
    if (rest > 0) return `${who} comentou · +${rest}`;
    return `${who} comentou`;
  }

  if (likes > 0) {
    if (first && likes > 1) return `${first} e mais ${likes - 1} pessoas curtiram`;
    if (first) return `${first} curtiu`;
    return `${likes} curtidas`;
  }

  if (saves > 0) return `${saves} salvamentos`;

  return null;
}

function safeCount(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.trunc(v);
}

function summarizeKindPlural(kindRaw: string, count: number) {
  const k = String(kindRaw || "").toLowerCase();
  if (k === "chapter") return count === 1 ? "capítulo" : "capítulos";
  if (k === "memory") return count === 1 ? "memória" : "memórias";
  if (k === "version") return count === 1 ? "versão" : "versões";
  return count === 1 ? "item" : "itens";
}

function getRelativePeriodBucket(iso: string): "day" | "week" | "month" | "older" {
  const ms = safeDateMs(iso);
  if (ms == null) return "older";
  const diff = Math.max(0, Date.now() - ms);
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "day";
  if (diff < 7 * day) return "week";
  if (diff < 30 * day) return "month";
  return "older";
}

function getRelativePeriodLabelByAgeMs(ageMs: number) {
  const day = 24 * 60 * 60 * 1000;
  if (ageMs < day) return "nas últimas 24h";
  if (ageMs < 7 * day) return "nos últimos 7 dias";
  if (ageMs < 30 * day) return "neste mês";
  return "recentemente";
}

function summarizePeriod(items: FeedCardModel[]) {
  const stamps = items
    .map((x) => safeDateMs(x.whenIso))
    .filter((x): x is number => typeof x === "number")
    .sort((a, b) => b - a);

  if (!stamps.length) return "recentemente";

  const oldest = stamps[stamps.length - 1];
  const oldestAge = Math.max(0, Date.now() - oldest);
  return getRelativePeriodLabelByAgeMs(oldestAge);
}

function getCardPulseCopy(c: FeedCardModel) {
  const kind = String(c.kindRaw || "").toLowerCase();
  const action = String(c.actionRaw || "").toLowerCase();

  if (kind === "chapter" && action === "published") {
    return "Um capítulo ganhou forma pública e amplia o mapa da sua história.";
  }
  if (kind === "chapter" && action === "created") {
    return "Uma nova trilha narrativa começou a se desenhar no seu ecossistema.";
  }
  if (kind === "memory" && action === "updated") {
    return "Uma lembrança voltou ao centro e recebeu nova camada de sentido.";
  }
  if (kind === "memory" && action === "created") {
    return "Uma memória entrou em circulação e fortalece o pulso do seu arquivo humano.";
  }
  if (kind === "version") {
    return "Uma nova versão preserva contexto, evolução e continuidade editorial.";
  }
  return "Seu universo narrativo segue produzindo sinais de presença, contexto e continuidade.";
}

function getGroupPulseCopy(g: FeedGroupModel) {
  const kind = String(g.kindRaw || "").toLowerCase();
  const action = String(g.actionRaw || "").toLowerCase();

  if (kind === "chapter" && action === "published") {
    return "Publicações próximas começaram a formar um arco editorial visível.";
  }
  if (kind === "chapter" && action === "created") {
    return "Novos capítulos estão se organizando como blocos de uma narrativa maior.";
  }
  if (kind === "memory" && action === "created") {
    return "Memórias recentes começam a desenhar recorrência e ritmo no seu feed.";
  }
  if (kind === "memory" && action === "updated") {
    return "Revisões próximas mostram que a história segue viva e em lapidação.";
  }
  return "Movimentos correlatos começaram a sugerir sequência, densidade e intenção narrativa.";
}

function getDiscoveryHeading(items: FeedCardModel[]) {
  const first = items[0];
  if (!first) return "Em circulação na plataforma";
  const kind = String(first.kindRaw || "").toLowerCase();
  if (kind === "chapter") return "Capítulos em circulação";
  if (kind === "memory") return "Memórias ganhando atenção";
  return "Sinais editoriais em circulação";
}

function getDiscoveryCopy(items: FeedCardModel[]) {
  if (!items.length) {
    return "A plataforma começa a destacar o que está puxando atenção e contexto neste momento.";
  }
  const period = summarizePeriod(items);
  return `A plataforma começa a recomendar histórias com maior sensação de circulação ${period}, reforçando descoberta editorial e presença narrativa.`;
}

function getDiscoveryBadgeText(items: FeedCardModel[]) {
  if (!items.length) return "curadoria editorial";
  const first = items[0];
  const kind = String(first.kindRaw || "").toLowerCase();
  if (kind === "chapter") return "capítulos em destaque";
  if (kind === "memory") return "memórias em destaque";
  return "curadoria editorial";
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
  whenIso: string;
  nav: string;
  score: number;
  actionRaw: string;
  social?: FeedV01Social;
  energy?: { emoji: string; text: string } | null;
};

type FeedGroupModel = {
  key: string;
  who: string;
  avatar_url: string | null;
  kindRaw: string;
  actionRaw: string;
  count: number;
  whenLabel: string;
  periodLabel: string;
  items: FeedCardModel[];
};

type FeedDiscoveryModel = {
  key: string;
  items: FeedCardModel[];
};

type FeedRenderItem =
  | { type: "card"; data: FeedCardModel }
  | { type: "group"; data: FeedGroupModel }
  | { type: "discovery"; data: FeedDiscoveryModel };

function buildCardFromV01(it: FeedV01Item, idx: number): FeedCardModel {
  const who = it?.actor?.name_public || "Autor";
  const verb = it?.social?.verb || verbPtBR(it?.action);
  const kindLabel = kindPtBR(it?.kind);
  const kindRaw = String(it?.kind || "");
  const title = it?.object?.title || "(sem título)";
  const preview = it?.object?.preview || null;
  const whenLabel = formatTimeAgoPtBR(it?.activity_at);
  const nav =
    it?.object?.nav || (String(it?.kind).toLowerCase() === "chapter" ? "/chapters" : "/memories");
  const score = normalizeScore(it);
  const actionRaw = String(it?.action || "");
  const energy = getEnergyTag(it);

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
    whenIso: String(it?.activity_at || new Date().toISOString()),
    nav,
    score,
    actionRaw,
    social: it?.social,
    energy,
  };
}

function buildCardFromSnapshot(m: any, idx: number): FeedCardModel {
  const title = m?.title || "(sem título)";
  const whenIso = m?.created_at || new Date().toISOString();
  const whenLabel = formatTimeAgoPtBR(whenIso);
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
    whenIso,
    nav: `/memories/${id}`,
    score: 0,
    actionRaw: isEdit ? "updated" : "created",
    social: {
      counts: { likes: 0, comments: 0, reposts: 0, saves: 0 },
      people: [],
      friendOf: null,
      verb,
    },
    energy: { emoji: isEdit ? "🔄" : "🧠", text: isEdit ? "Memória atualizada" : "Nova memória" },
  };
}

// ✅ cluster editorial por janela, não por adjacência rígida
function buildRenderFeed(cards: FeedCardModel[]): FeedRenderItem[] {
  const result: FeedRenderItem[] = [];
  const used = new Set<number>();

  for (let i = 0; i < cards.length; i++) {
    if (used.has(i)) continue;

    const current = cards[i];
    const cluster = [current];
    const currentMs = safeDateMs(current.whenIso) ?? 0;
    const currentBucket = getRelativePeriodBucket(current.whenIso);

    for (let j = i + 1; j < cards.length; j++) {
      if (used.has(j)) continue;

      const next = cards[j];
      const nextMs = safeDateMs(next.whenIso) ?? 0;
      const nextBucket = getRelativePeriodBucket(next.whenIso);

      const within7Days = Math.abs(currentMs - nextMs) <= 7 * 24 * 60 * 60 * 1000;
      const sameNarrativeWindow = currentBucket === nextBucket;
      const sameEditorialFamily =
        next.who === current.who &&
        next.kindRaw === current.kindRaw &&
        next.actionRaw === current.actionRaw;

      if (within7Days && sameNarrativeWindow && sameEditorialFamily) {
        cluster.push(next);
        used.add(j);
      }
    }

    if (cluster.length >= 2) {
      result.push({
        type: "group",
        data: {
          key: `group:${current.key}`,
          who: current.who,
          avatar_url: current.avatar_url,
          kindRaw: current.kindRaw,
          actionRaw: current.actionRaw,
          count: cluster.length,
          whenLabel: cluster[0].whenLabel,
          periodLabel: summarizePeriod(cluster),
          items: cluster,
        },
      });
      used.add(i);
    } else {
      result.push({ type: "card", data: current });
    }
  }

  if (cards.length >= 4) {
    const discoveryCandidates = cards.slice(1, 4);
    result.splice(Math.min(3, result.length), 0, {
      type: "discovery",
      data: {
        key: `discovery:${discoveryCandidates.map((x) => x.key).join("|")}`,
        items: discoveryCandidates,
      },
    });
  }

  return result;
}

function Badge({
  text,
  tone = "neutral",
  icon,
}: {
  text: string;
  tone?: "neutral" | "accent" | "soft" | "hot";
  icon?: string;
}) {
  const bg =
    tone === "accent"
      ? "var(--hdud-accent-bg)"
      : tone === "hot"
      ? "rgba(255, 200, 0, 0.12)"
      : tone === "soft"
      ? "rgba(255,255,255,0.05)"
      : "rgba(255,255,255,0.03)";

  const border =
    tone === "accent"
      ? "var(--hdud-accent-border)"
      : tone === "hot"
      ? "rgba(255, 200, 0, 0.22)"
      : "var(--hdud-border)";

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
      {icon ? <span style={{ opacity: 0.95 }}>{icon}</span> : null}
      {text}
    </span>
  );
}

function SoftActionButton({
  children,
  title,
  onClick,
  strong,
  icon,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  strong?: boolean;
  icon?: string;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      className={strong ? "hdud-btn hdud-btn-primary" : "hdud-btn"}
      title={title}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        transform: pressed ? "translateY(1px)" : "translateY(0px)",
        transition: "transform 90ms ease",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon ? <span style={{ opacity: 0.92 }}>{icon}</span> : null}
      {children}
    </button>
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

  const counts = c.social?.counts || {};
  const likes = safeCount(counts.likes);
  const comments = safeCount(counts.comments);
  const reposts = safeCount(counts.reposts);
  const saves = safeCount(counts.saves);

  const voice = formatSocialVoice(c.social);
  const friendOfLabel = c.social?.friendOf?.label ? String(c.social.friendOf.label) : null;

  const onActivate = () => onOpen(c.nav);

  return (
    <div
      className="hdud-card hdud-feed-card"
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
        padding: 16,
        borderRadius: 18,
        cursor: "pointer",
        transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
        boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
        border: "1px solid var(--hdud-border)",
        background: "var(--hdud-surface)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 15,
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
            />
          ) : (
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>{initials(c.who)}</div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.92, lineHeight: 1.2 }}>
                <span style={{ fontWeight: 1000 }}>{c.who}</span>{" "}
                <span style={{ fontWeight: 850, opacity: 0.78 }}>{c.verb}</span>{" "}
                <span style={{ fontWeight: 850 }}>um</span>{" "}
                <span style={{ fontWeight: 950 }}>{c.kindLabel}</span>{" "}
                <span style={{ marginLeft: 6, opacity: 0.85 }}>{kindIcon(c.kindRaw)}</span>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge text={c.whenLabel} tone="soft" icon="⏱️" />
                {c.energy ? <Badge text={c.energy.text} tone="hot" icon={c.energy.emoji} /> : null}
                {c.score > 0 ? <Badge text={`relevância ${c.score}`} tone="accent" icon="📈" /> : null}
              </div>
            </div>

            <SoftActionButton
              strong
              icon="↗️"
              title="Abrir"
              onClick={(e) => {
                e.stopPropagation();
                onActivate();
              }}
            >
              Abrir
            </SoftActionButton>
          </div>

          <div
            style={{
              marginTop: 14,
              fontSize: 18,
              fontWeight: 950,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={c.title}
          >
            {c.title}
          </div>

          {c.preview?.trim() ? (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.84, lineHeight: 1.48 }}>
              {clampText(c.preview, 240)}
            </div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.78, lineHeight: 1.45 }}>
              {getCardPulseCopy(c)}
            </div>
          )}

          {voice ? (
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.84, lineHeight: 1.45 }}>
              <span style={{ fontWeight: 900 }}>{voice}</span>
              {friendOfLabel ? <span style={{ marginLeft: 8, fontWeight: 800, opacity: 0.82 }}>· {friendOfLabel}</span> : null}
              <div style={{ marginTop: 4, opacity: 0.76 }}>
                {likes} curtidas · {comments} comentários · {reposts} reposts · {saves} salvos
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75, lineHeight: 1.45 }}>
              Ainda sem reação registrada — mas o pulso narrativo já está em circulação.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedGroupCard({
  g,
  onOpen,
}: {
  g: FeedGroupModel;
  onOpen: (nav: string) => void;
}) {
  const avatarAbs = toAbsoluteCdnUrl(g.avatar_url);
  const showAvatar = !!avatarAbs;
  const plural = summarizeKindPlural(g.kindRaw, g.count);
  const verb = verbPtBR(g.actionRaw);

  return (
    <div
      className="hdud-card hdud-feed-card"
      style={{
        padding: 16,
        borderRadius: 18,
        boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
        border: "1px solid var(--hdud-border)",
        background: "var(--hdud-surface)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 15,
            overflow: "hidden",
            border: "1px solid var(--hdud-border)",
            background: "rgba(255,255,255,0.04)",
            display: "grid",
            placeItems: "center",
          }}
        >
          {showAvatar ? (
            <img src={avatarAbs} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>{initials(g.who)}</div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 1000, fontSize: 16, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            {g.who} {verb} {g.count} {plural} {g.periodLabel}
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge text={g.whenLabel} tone="soft" icon="⏱️" />
            <Badge text="sequência editorial" tone="accent" icon="◎" />
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8, lineHeight: 1.45 }}>
            {getGroupPulseCopy(g)}
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {g.items.slice(0, 3).map((item) => (
              <button
                key={item.key}
                className="hdud-btn"
                style={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  width: "100%",
                  padding: "10px 12px",
                }}
                onClick={() => onOpen(item.nav)}
                title={item.title}
              >
                <span style={{ fontWeight: 900 }}>{kindIcon(item.kindRaw)}</span>
                <span
                  style={{
                    marginLeft: 8,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscoveryCard({
  d,
  onOpen,
}: {
  d: FeedDiscoveryModel;
  onOpen: (nav: string) => void;
}) {
  const heading = getDiscoveryHeading(d.items);
  const copy = getDiscoveryCopy(d.items);
  const badgeText = getDiscoveryBadgeText(d.items);

  return (
    <div
      className="hdud-card"
      style={{
        padding: 16,
        borderRadius: 18,
        border: "1px solid var(--hdud-border)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.03))",
        boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 1000, letterSpacing: "-0.02em", fontSize: 16 }}>{heading}</div>
          <div style={{ marginTop: 6, fontSize: 12.5, opacity: 0.8, lineHeight: 1.45 }}>{copy}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Badge text={badgeText} tone="accent" icon="✦" />
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {d.items.map((item) => (
          <button
            key={item.key}
            className="hdud-btn"
            style={{
              justifyContent: "space-between",
              textAlign: "left",
              width: "100%",
              padding: "11px 12px",
              gap: 12,
            }}
            onClick={() => onOpen(item.nav)}
            title={item.title}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minWidth: 0,
                gap: 8,
                overflow: "hidden",
              }}
            >
              <span style={{ fontWeight: 900 }}>{kindIcon(item.kindRaw)}</span>
              <span
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.title}
              </span>
            </span>

            <span style={{ flexShrink: 0, opacity: 0.72, fontSize: 12, fontWeight: 800 }}>
              {item.whenLabel}
            </span>
          </button>
        ))}
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

  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const token = getToken();
  const authorId = getAuthorIdFromToken(token);

  const seqRef = useRef(0);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

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

      const r = await withTimeout(fetchFeedDirect(qs, t), 6500, "Timeout do feed real. Usando fallback.");
      debugFeed("direct feed response", r, "urlBase", getDirectFeedBase());

      const itemsArr = pickItemsArray(r);

      if (isV01Version(r?.version) && Array.isArray(itemsArr)) {
        if (seq !== seqRef.current) return;

        const ranked = sortTimeThenScore(itemsArr as FeedV01Item[]);
        const nextCursor = (r?.meta?.next_cursor || r?.meta?.cursor_next || r?.meta?.cursor || null) as any;

        if (mode === "replace") {
          setFeedV01({
            ...(r as FeedV01Response),
            version: String(r?.version || "FEED_v0.1"),
            items: ranked,
          });
        } else {
          setFeedV01((prev) => {
            const prevItems = prev?.items || [];
            const merged = sortTimeThenScore([...prevItems, ...ranked]);
            return prev
              ? { ...prev, items: merged }
              : ({ ...(r as FeedV01Response), items: merged } as FeedV01Response);
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

        const ranked = sortTimeThenScore(coerced.items || []);
        if (mode === "replace") setFeedV01({ ...coerced, items: ranked });
        else {
          setFeedV01((prev) => {
            const prevItems = prev?.items || [];
            const merged = sortTimeThenScore([...prevItems, ...ranked]);
            return prev
              ? { ...prev, items: merged }
              : ({ ...coerced, items: merged } as FeedV01Response);
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
  }, [token]);

  const rankedItems = useMemo(() => {
    if (!feedV01?.items?.length) return [];
    return sortTimeThenScore(feedV01.items);
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
    if (snapshot) return "Fallback ativo";
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

  const renderFeed = useMemo(() => {
    if (!cards?.length) return [];
    return buildRenderFeed(cards);
  }, [cards]);

  const topEnergy = useMemo(() => {
    const first = rankedItems?.[0];
    if (!first) return null;
    return getEnergyTag(first);
  }, [rankedItems]);

  const recentPulse = useMemo(() => {
    if (!cards?.length) return 0;
    return cards.filter((x) => isRecentActivity(x.whenLabel)).length;
  }, [cards]);

  const editorialPulseText = useMemo(() => {
    if (!cards?.length) return "Seu feed vai ganhar densidade conforme novas memórias e capítulos entrarem em circulação.";
    if (recentPulse >= 4) return "Seu ecossistema está em aceleração: há sinais narrativos recentes ganhando presença.";
    if (recentPulse >= 1) return "Há movimento recente no seu universo — a plataforma já começa a sugerir pulso editorial.";
    return "A base narrativa está montada e pronta para ganhar mais circulação com novos movimentos.";
  }, [cards, recentPulse]);

  function onFeedScroll() {
    const el = feedScrollRef.current;
    if (!el) return;
    if (loading || loadingMore || !hasMore) return;

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
  }, [hasMore, loading, loadingMore, cursor]);

  const layoutStyle: React.CSSProperties = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: "320px minmax(560px, 1fr) 360px",
      gap: 14,
      alignItems: "start",
      maxWidth: 1720,
      margin: "0 auto",
      flex: 1,
      minHeight: 0,
      overflow: "hidden",
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
    <div
      className="hdud-page"
      style={{
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="hdud-card"
        style={{
          padding: 16,
          borderRadius: 18,
          boxShadow: "0 12px 36px rgba(0,0,0,0.22)",
          marginBottom: 14,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 1000, letterSpacing: "-0.03em" }}>
              Feed — o presente narrativo
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.78 }}>
              Aqui a história humana está viva.{" "}
              <span style={{ opacity: 0.9, fontWeight: 900 }}>{hintMode}</span>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Badge text={headerName} tone="neutral" icon="👤" />
              <Badge text={`${storyCounts.memories} memórias`} tone="soft" icon="📝" />
              <Badge text={`${storyCounts.chapters} capítulos`} tone="soft" icon="📘" />
              {recentPulse > 0 ? (
                <Badge text={`${recentPulse} movimentos recentes`} tone="accent" icon="◎" />
              ) : null}
              {topEnergy ? <Badge text={topEnergy.text} tone="hot" icon={topEnergy.emoji} /> : null}
            </div>

            <div style={{ marginTop: 12, fontSize: 12.5, opacity: 0.8, lineHeight: 1.45 }}>
              {editorialPulseText}
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
            Você ainda não entrou. Faça login para ver seu presente narrativo.
          </div>
        ) : null}
      </div>

      <div style={layoutStyle}>
        <aside style={{ position: "sticky", top: 0, alignSelf: "start" }}>
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
                <Badge text="editorial-grade" tone="neutral" />
                <Badge text="rede em formação" tone="neutral" />
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78, lineHeight: 1.35 }}>
                O feed agora combina movimento, agrupamento coerente e descoberta com acabamento mais próximo de produto global.
              </div>
            </div>
          </div>
        </aside>

        <section
          style={{
            minWidth: 0,
            minHeight: 0,
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              borderRadius: 18,
              border: "1px solid var(--hdud-border)",
              background: "transparent",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              ref={feedScrollRef}
              style={{
                flex: 1,
                minHeight: 0,
                height: "100%",
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
                      Crie ou edite uma memória ou capítulo para o feed ganhar vida.
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
                    {renderFeed.map((item) => {
                      if (item.type === "card") {
                        return <FeedCard key={item.data.key} c={item.data} onOpen={openNav} />;
                      }

                      if (item.type === "group") {
                        return <FeedGroupCard key={item.data.key} g={item.data} onOpen={openNav} />;
                      }

                      return <DiscoveryCard key={item.data.key} d={item.data} onOpen={openNav} />;
                    })}

                    {hasMore ? (
                      <div className="hdud-card" style={{ padding: 14, borderRadius: 18 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ fontWeight: 950 }}>Carregando mais movimento…</div>
                          <button className="hdud-btn" disabled={loadingMore} onClick={() => void load("append")}>
                            {loadingMore ? "…" : "Carregar mais"}
                          </button>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                          O feed continua trazendo novas atividades conforme você avança.
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "8px 0", opacity: 0.7, fontSize: 12 }}>
                        você chegou ao fim das atualizações
                      </div>
                    )}

                    {loadingMore ? <SkeletonCard /> : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside style={{ position: "sticky", top: 0, alignSelf: "start" }}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={cardShellStyle}>
              <div style={sectionTitleStyle}>Insights</div>

              <div style={{ display: "grid", gap: 10 }}>
                <div
                  className="hdud-card"
                  style={{ padding: 12, borderRadius: 16, boxShadow: "0 10px 26px rgba(0,0,0,0.16)" }}
                >
                  <div style={{ fontWeight: 950, fontSize: 13 }}>Sua jornada</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Badge text={`${storyCounts.memories} memórias`} tone="soft" icon="📝" />
                    <Badge text={`${storyCounts.chapters} capítulos`} tone="soft" icon="📘" />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78, lineHeight: 1.35 }}>
                    Ranking: <b>recency + action_weight + social_signal</b>.
                  </div>
                </div>

                <div
                  className="hdud-card"
                  style={{ padding: 12, borderRadius: 16, boxShadow: "0 10px 26px rgba(0,0,0,0.16)" }}
                >
                  <div style={{ fontWeight: 950, fontSize: 13 }}>Rede em formação</div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
                    O feed já sugere descoberta, movimento e agrupamento editorial usando os sinais atuais do backend.
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Badge text="descoberta" tone="accent" />
                    <Badge text="agrupamento" tone="neutral" />
                    <Badge text="movimento" tone="neutral" />
                  </div>
                </div>

                <div
                  className="hdud-card"
                  style={{ padding: 12, borderRadius: 16, boxShadow: "0 10px 26px rgba(0,0,0,0.16)" }}
                >
                  <div style={{ fontWeight: 950, fontSize: 13 }}>Próximo salto</div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
                    Base pronta para trilhos futuros como <b>/feed/home</b>, <b>/feed/network</b> e <b>/feed/global</b>.
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Badge text="feed v0.5 estrutural" tone="accent" />
                    <Badge text="sensação de rede" tone="neutral" />
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
                  <br />
                  feedBase: <b>{getDirectFeedBase()}</b>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}