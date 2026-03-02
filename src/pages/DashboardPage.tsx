/* C:\HDUD_DATA\hdud-web-app\src\pages\DashboardPage.tsx */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import LivingEcosystem, { type LivingStory } from "../components/LivingEcosystem";

// ============================
// Compat / Helpers
// ============================
function getAnyToken(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    null
  );
}

function apiBase(): string {
  return (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:4000";
}

function resolveAssetUrl(input: string | null): string | null {
  const s = String(input || "").trim();
  if (!s) return null;

  if (/^https?:\/\/.+/i.test(s)) return s;

  const base = apiBase().replace("localhost", "127.0.0.1");
  if (s.startsWith("/")) return `${base}${s}`;
  return `${base}/${s}`;
}

function clampText(s: string, max = 160): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function firstHumanFragment(content: string): string {
  const t = String(content ?? "").trim();
  if (!t) return "";
  const line =
    t
      .split(/\n+/)
      .map((x) => x.trim())
      .filter(Boolean)[0] || "";
  const sentence = line.split(/(?<=[\.\!\?…])\s+/)[0] || line;
  return clampText(sentence, 160);
}

function safeDateMs(value: any): number | null {
  if (!value) return null;
  const d1 = new Date(value);
  if (!isNaN(d1.getTime())) return d1.getTime();
  const d2 = new Date(String(value).replace(" ", "T"));
  if (!isNaN(d2.getTime())) return d2.getTime();
  return null;
}

function formatRelative(iso?: string | null): string {
  const ms = safeDateMs(iso);
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return `há ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  const mo = Math.floor(d / 30);
  return `há ${mo}m`;
}

function computeInitialsFromName(name?: string | null): string {
  const raw = String(name || "").trim();
  if (!raw) return "AN";
  const parts = raw
    .split(/\s+/g)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "AN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].slice(0, 1);
  const last = parts[parts.length - 1].slice(0, 1);
  return `${first}${last}`.toUpperCase() || "AN";
}

// ============================
// Seed (Demo) — Multi-Authors
// ============================
function seedStories(): LivingStory[] {
  const seeds: LivingStory[] = [
    { id: "seed-ana-1", authorName: "Ana Ribeiro", title: "Carta que nunca enviei", fragment: "Talvez eu esteja lembrando errado. Mesmo assim…" },
    { id: "seed-joao-1", authorName: "João Matos", title: "Três empregos, dois filhos, um silêncio", fragment: "Foi quando percebi que ninguém estava olhando." },
    { id: "seed-luiza-1", authorName: "Luiza A.", title: "O dia em que minha mãe não reconheceu meu nome", fragment: "Isso não aparece nas fotos." },
    { id: "seed-miguel-1", authorName: "Miguel Santos", title: "Eu achava que tinha superado", fragment: "Não sei se foi ali que tudo mudou, mas foi quando percebi." },
    { id: "seed-carla-1", authorName: "Carla N.", title: "Uma alegria pequena demais para contar", fragment: "E ainda assim, foi o que me manteve em pé." },

    { id: "seed-lia-1", authorName: "Lia S.", title: "Capítulo: O ano em que eu virei gente", fragment: "Eu não sabia, mas eu estava começendo." },
    { id: "seed-bruno-1", authorName: "Bruno Azevedo", title: "Capítulo: A cidade que me engoliu", fragment: "Não foi rápido. Foi aos poucos, e por dentro." },
    { id: "seed-nina-1", authorName: "Nina Campos", title: "O cheiro do corredor", fragment: "Algumas lembranças não têm imagem. Têm cheiro." },
    { id: "seed-rafa-1", authorName: "Rafa M.", title: "Quando eu pedi desculpas pro meu pai", fragment: "Eu achei que seria tarde demais. Não foi." },
    { id: "seed-diego-1", authorName: "Diego Lima", title: "Capítulo: Meu mapa da vida", fragment: "Eu precisava de um nome pra cada fase." },
  ];

  try {
    const key = "hdud_home_seed_shuffle";
    const prev = sessionStorage.getItem(key);
    const base = prev ? Number(prev) : Math.floor(Math.random() * 10_000);
    sessionStorage.setItem(key, String(base));

    const arr = [...seeds];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (base + i * 31) % (i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  } catch {
    return seeds;
  }
}

// ============================
// Types (API)
// ============================
type MeProfile = {
  author_id: number;
  email: string | null;
  name_public: string | null;
  bio_short: string | null;
  location: string | null;
  avatar_url: string | null;
};

type FeedItem = {
  type: "memory" | "chapter";
  title: string;
  date: string;
  source_id: string;
  meta?: {
    nav?: string;
    preview?: string;
    chapter_id?: number;
    status?: string | null;
    description?: string;
    activity_at?: string;
    author_name?: string;
    author?: string;
  };
};

type FeedResponse = { profile?: any; items?: FeedItem[]; meta?: any };

// ============================
// UI helpers (token-first)
// ============================
function useIsWide(minWidth = 1100) {
  const [wide, setWide] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia(`(min-width: ${minWidth}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const onChange = () => setWide(mq.matches);
    onChange();
    if ((mq as any).addEventListener) (mq as any).addEventListener("change", onChange);
    else (mq as any).addListener(onChange);
    return () => {
      if ((mq as any).removeEventListener) (mq as any).removeEventListener("change", onChange);
      else (mq as any).removeListener(onChange);
    };
  }, [minWidth]);

  return wide;
}

function isPublishedHuman(item: FeedItem): boolean {
  if (!item) return false;
  if (item.type !== "memory" && item.type !== "chapter") return false;

  const stRaw = (item?.meta?.status ?? "").toString().trim().toLowerCase();
  if (!stRaw) return true;
  if (stRaw.includes("draft")) return false;
  if (stRaw.includes("rascun")) return false;
  if (stRaw.includes("unpub")) return false;
  if (stRaw.includes("private")) return false;
  if (stRaw.includes("hidden")) return false;
  return true;
}

function nowKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = d.getHours();
  const band = h < 6 ? "madrugada" : h < 12 ? "manhã" : h < 18 ? "tarde" : "noite";
  return `${y}-${m}-${day}-${band}`;
}

function isSameLocalDay(aMs: number, bMs: number) {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function pickDeterministic<T>(arr: T[], seed: number): T | null {
  if (!arr?.length) return null;
  const idx = Math.abs(seed) % arr.length;
  return arr[idx] ?? null;
}

function hashStr(s: string): number {
  const t = String(s || "");
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return h;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ============================
// Icons for composer actions + feed actions
// ============================
function ComposerIcon({ name }: { name: "text" | "photo" | "article" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    xmlns: "http://www.w3.org/2000/svg",
  };

  if (name === "photo") {
    return (
      <svg {...common} aria-hidden>
        <path
          d="M4 6a2 2 0 0 1 2-2h3l1.2 1.6h7.8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M9 13l2-2 3 3 2-2 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 9h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "article") {
    return (
      <svg {...common} aria-hidden>
        <path d="M6 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" />
        <path d="M8 8h10M8 12h10M8 16h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg {...common} aria-hidden>
      <path d="M5 6h14M5 10h10M5 14h14M5 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ActionIcon({ name }: { name: "like" | "comment" | "repost" | "save" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    xmlns: "http://www.w3.org/2000/svg",
  };

  if (name === "comment") {
    return (
      <svg {...common} aria-hidden>
        <path
          d="M20 15a4 4 0 0 1-4 4H9l-5 3V7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "repost") {
    return (
      <svg {...common} aria-hidden>
        <path
          d="M7 7h10l-2-2M17 17H7l2 2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M7 7v6a3 3 0 0 0 3 3h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M17 17v-6a3 3 0 0 0-3-3H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "save") {
    return (
      <svg {...common} aria-hidden>
        <path
          d="M6 4h12a2 2 0 0 1 2 2v16l-8-4-8 4V6a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // like
  return (
    <svg {...common} aria-hidden>
      <path
        d="M14 9V5a3 3 0 0 0-3-3l-1 7H6a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h7.2a3 3 0 0 0 2.93-2.34l1.1-5.5A2 2 0 0 0 15.27 7H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================
// Dashboard
// ============================
export default function DashboardPage() {
  const navigate = useNavigate();
  const isWide = useIsWide(1100);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<MeProfile | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedMode, setFeedMode] = useState<"top" | "recent">("top");

  const seqRef = useRef(0);

  function openChapter(rawId: any) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      navigate("/chapters");
      return;
    }
    try {
      sessionStorage.setItem("hdud_open_chapter_id", String(id));
    } catch {}
    navigate("/chapters");
  }

  function openMemory(rawId: any) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      navigate("/memories");
      return;
    }
    navigate(`/memories/${id}`);
  }

  function goMemories(intent: "text" | "photo" = "text") {
    try {
      sessionStorage.setItem("hdud_memories_intent", intent);
    } catch {}
    navigate("/memories");
  }

  function goChapters() {
    try {
      sessionStorage.setItem("hdud_chapters_intent", "article");
    } catch {}
    navigate("/chapters");
  }

  async function load(mode: "initial" | "refresh" = "initial") {
    const seq = ++seqRef.current;

    const token = getAnyToken();
    if (!token) {
      setMe(null);
      setFeed([]);
      setLoading(false);
      setRefreshing(false);
      setError("Não autenticado. Faça login novamente.");
      return;
    }

    setError(null);
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    try {
      const base = apiBase().replace("localhost", "127.0.0.1");
      const headers = { Authorization: `Bearer ${token}` };

      const pMe = fetch(`${base}/me/profile`, { headers }).then(async (r) => {
        if (!r.ok) throw new Error(`Falha ao carregar perfil (HTTP ${r.status}).`);
        return (await r.json()) as MeProfile;
      });

      const pFeed = fetch(`${base}/feed?limit=24`, { headers }).then(async (r) => {
        if (!r.ok) throw new Error(`Falha ao carregar feed (HTTP ${r.status}).`);
        return (await r.json()) as FeedResponse;
      });

      const [meRes, feedRes] = await Promise.all([pMe, pFeed]);
      if (seq !== seqRef.current) return;

      setMe(meRes);
      setFeed(Array.isArray(feedRes?.items) ? feedRes.items : []);

      // ✅ sincroniza AppShell (foto/bio sempre)
      try {
        const name = String(meRes?.name_public ?? "").trim() || "Autor";
        const bio = String(meRes?.bio_short ?? "").trim() || "HDUD";
        const headline = String(meRes?.location ?? "").trim() || "";
        localStorage.setItem(
          "HDUD_PROFILE",
          JSON.stringify({
            name,
            bio,
            headline,
            avatar_url: meRes?.avatar_url ?? null,
          })
        );
      } catch {}
    } catch (e: any) {
      if (seq !== seqRef.current) return;
      setError(e?.message || "Falha ao carregar seu universo.");
      setMe(null);
      setFeed([]);
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    void load("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = useMemo(() => {
    const n = (me?.name_public ?? "").trim();
    return n || "Autor";
  }, [me?.name_public]);

  const initials = useMemo(() => computeInitialsFromName(me?.name_public), [me?.name_public]);
  const avatarAbs = useMemo(() => resolveAssetUrl(me?.avatar_url ?? null), [me?.avatar_url]);

  const chaptersTop5 = useMemo(() => feed.filter((x) => x.type === "chapter").slice(0, 5), [feed]);
  const memoriesTop5 = useMemo(() => feed.filter((x) => x.type === "memory").slice(0, 5), [feed]);

  const pulse = useMemo(() => {
    const now = Date.now();
    const twoH = 2 * 60 * 60 * 1000;
    const day24 = 24 * 60 * 60 * 1000;

    const published = feed.filter(isPublishedHuman);

    const withMs = published.map((it) => {
      const ms = safeDateMs(it?.meta?.activity_at || it?.date) ?? null;
      return { it, ms };
    });

    const last24h = withMs.filter((x) => x.ms != null && now - (x.ms as number) <= day24);
    const last2h = withMs.filter((x) => x.ms != null && now - (x.ms as number) <= twoH);

    const todayChapters = withMs.filter((x) => {
      if (x.it.type !== "chapter") return false;
      if (x.ms == null) return false;
      return isSameLocalDay(x.ms as number, now);
    });

    const signals24h = last24h.length;
    const stories2h = last2h.filter((x) => x.it.type === "memory").length;
    const chaptersToday = todayChapters.length;

    const featured =
      [...withMs]
        .filter((x) => x.ms != null)
        .sort((a, b) => (b.ms as number) - (a.ms as number))[0]?.it ||
      published[0] ||
      null;

    return { signals24h, stories2h, chaptersToday, featured };
  }, [feed]);

  type OrganicItem = {
    id: string;
    kind: "memory" | "chapter";
    title: string;
    fragment: string;
    atIso?: string | null;
    actor: string;
    action: string;
    href: string;
    emphasis?: "featured" | "normal";
    socialHint?: string;

    // LinkedIn-ish metrics (deterministic)
    likes?: number;
    comments?: number;
    reposts?: number;
    saves?: number;
    score?: number;
  };

  const organicItemsRaw: OrganicItem[] = useMemo(() => {
    const seeds = seedStories();
    const published = feed.filter(isPublishedHuman);

    const peoplePool = Array.from(
      new Set(
        [
          ...seeds.map((s) => String(s.authorName || "").trim()),
          "Pedro Tavares",
          "Marina Costa",
          "Thiago Ramos",
          "Paula Nunes",
          "Rafael Rocha",
          "Bia Martins",
          "Júlio L.",
        ].filter(Boolean)
      )
    );

    const verbs = ["publicou", "atualizou"];
    const reactions = ["curtiu isso", "comentou", "repostou", "salvou"];

    const pickPerson = (key: string, salt = 0) => pickDeterministic(peoplePool, hashStr(key) + salt) || "Alguém";

    const actionFor = (it: FeedItem) => {
      if (it.type === "chapter") return "atualizou";
      return "publicou";
    };

    const socialFor = (key: string) => {
      const p1 = pickPerson(key, 19);
      const p2 = pickPerson(key, 41);
      const r = pickDeterministic(reactions, hashStr(key) + 77) || "curtiu isso";
      const kind = (hashStr(key) & 1) === 0 ? "Amigo" : "Amigo de amigo";
      if (p1 === p2) return `${kind}: ${p1} ${r}`;
      return `${kind}: ${p1} • ${p2} ${r}`;
    };

    const metricsFor = (key: string) => {
      const h = Math.abs(hashStr(key));
      // ranges “realistas” tipo LinkedIn
      const likes = clampInt((h % 120) + 3, 0, 999);
      const comments = clampInt(((h >> 3) % 14), 0, 99);
      const reposts = clampInt(((h >> 6) % 9), 0, 99);
      const saves = clampInt(((h >> 9) % 17), 0, 99);

      // score: peso likes + comments + reposts + saves
      const score = likes * 1 + comments * 3 + reposts * 4 + saves * 2;
      return { likes, comments, reposts, saves, score };
    };

    const real: OrganicItem[] = published.slice(0, 16).map((it) => {
      const title = (it.title || "").trim() || "Sem título";
      const frag =
        firstHumanFragment(it?.meta?.preview || "") ||
        firstHumanFragment((it as any)?.content || "") ||
        (it.type === "chapter" ? "Um mapa da vida em construção." : "Ainda não sei como dizer. Mesmo assim…");

      const href =
        it?.meta?.nav ||
        (it.type === "chapter" ? "/chapters" : `/memories/${Number(it.source_id) || it.source_id}`);

      const atIso = it?.meta?.activity_at || it?.date || null;

      const actor = String(it?.meta?.author_name || it?.meta?.author || "").trim() || displayName || "Autor";
      const action = actionFor(it);

      const key = `${it.type}-${it.source_id}-${title}`;
      const mx = metricsFor(key);

      return {
        id: `${it.type}-${it.source_id}`,
        kind: it.type,
        title,
        fragment: frag,
        atIso,
        actor,
        action,
        href,
        emphasis: "normal",
        socialHint: socialFor(key),
        ...mx,
      };
    });

    const seed: OrganicItem[] = seeds.slice(0, 12).map((s) => {
      const title = (s.title || "").trim() || "Sem título";
      const fragment = clampText(String(s.fragment || ""), 160) || "—";
      const href = (s as any)?.href || "/";

      const key = String(s.id || title);
      const actor = String(s.authorName || pickPerson(key));
      const verb = pickDeterministic(verbs, hashStr(key) + 17) || "publicou";

      const mx = metricsFor(key);

      return {
        id: String(s.id || key),
        kind: title.toLowerCase().includes("capítulo") ? "chapter" : "memory",
        title,
        fragment,
        atIso: null,
        actor,
        action: verb,
        href,
        emphasis: "normal",
        socialHint: `${pickPerson(key, 88)} curtiu isso`,
        ...mx,
      };
    });

    const merged = [...real, ...seed];

    const featured = pulse.featured;
    const featuredId = featured ? `${featured.type}-${featured.source_id}` : null;

    const out = merged.map((x) => {
      if (featuredId && x.id === featuredId) return { ...x, emphasis: "featured" as const };
      return x;
    });

    if (!out.some((x) => x.emphasis === "featured") && out[0]) out[0] = { ...out[0], emphasis: "featured" };

    return out.slice(0, 18);
  }, [feed, displayName, pulse.featured]);

  const organicItems: OrganicItem[] = useMemo(() => {
    const arr = [...organicItemsRaw];

    if (feedMode === "recent") {
      arr.sort((a, b) => {
        const am = safeDateMs(a.atIso) ?? 0;
        const bm = safeDateMs(b.atIso) ?? 0;
        return bm - am;
      });
      return arr;
    }

    // top: destaque + score
    arr.sort((a, b) => {
      const aFeat = a.emphasis === "featured" ? 1 : 0;
      const bFeat = b.emphasis === "featured" ? 1 : 0;
      if (bFeat !== aFeat) return bFeat - aFeat;

      const as = a.score ?? 0;
      const bs = b.score ?? 0;
      if (bs !== as) return bs - as;

      const am = safeDateMs(a.atIso) ?? 0;
      const bm = safeDateMs(b.atIso) ?? 0;
      return bm - am;
    });

    return arr;
  }, [organicItemsRaw, feedMode]);

  const dayBand = useMemo(() => nowKey(), []);
  const epicentroLine = useMemo(() => {
    if (dayBand.includes("madrugada")) return "Silêncio por fora. Movimento por dentro.";
    if (dayBand.includes("manhã")) return "Comece publicando o que importa.";
    if (dayBand.includes("tarde")) return "O mundo segue — por dentro.";
    return "A noite guarda confissões.";
  }, [dayBand]);

  // ============================
  // Styles (LinkedIn-ish: centro manda, topo discreto)
  // ============================
  const styles = useMemo(() => {
    return `
      @keyframes hdudPulseBreath {
        0% { transform: scale(1); opacity: 0.70; }
        50% { transform: scale(1.22); opacity: 1; }
        100% { transform: scale(1); opacity: 0.70; }
      }
      .hdud-pulse-dot { animation: hdudPulseBreath 1.55s ease-in-out infinite; }

      .hdud-subtle-divider { height:1px; background: var(--hdud-dash-divider); }

      .hdud-feed-card { transform: translateY(0); box-shadow: var(--hdud-shadow-1); }
      .hdud-feed-card:hover {
        transform: translateY(-1px);
        box-shadow: var(--hdud-dash-hover-shadow);
        border-color: var(--hdud-dash-hover-border);
      }
      .hdud-feed-card:active {
        transform: translateY(0px);
        box-shadow: var(--hdud-dash-active-shadow);
      }

      .hdud-mini-card { box-shadow: var(--hdud-shadow-0); }
      .hdud-mini-card:hover {
        transform: translateY(-1px);
        box-shadow: var(--hdud-dash-mini-hover-shadow);
        border-color: var(--hdud-dash-hover-border);
      }

      .hdud-composer-input:hover {
        transform: translateY(-1px);
        box-shadow: var(--hdud-shadow-1);
        border-color: var(--hdud-accent-border);
      }
      .hdud-composer-action:hover {
        background: var(--hdud-hover);
        border-color: var(--hdud-border);
      }

      .hdud-rail-item { box-shadow: none !important; }
      .hdud-rail-item:hover { box-shadow: var(--hdud-shadow-1) !important; }

      .hdud-seg { display:inline-flex; border: 1px solid var(--hdud-border); background: var(--hdud-surface-2); border-radius: 999px; padding: 3px; }
      .hdud-seg button { border: 0; background: transparent; border-radius: 999px; padding: 7px 10px; font-weight: 900; font-size: 12px; opacity: 0.82; cursor: pointer; }
      .hdud-seg button[data-active="true"] { background: var(--hdud-card); opacity: 1; border: 1px solid var(--hdud-border); }

      .hdud-actions { display:flex; gap: 8px; align-items:center; flex-wrap: wrap; margin-top: 10px; }
      .hdud-action-btn { display:inline-flex; align-items:center; gap: 8px; padding: 8px 10px; border-radius: 12px; border: 1px solid transparent; background: transparent; font-weight: 900; font-size: 12px; opacity: 0.86; cursor: pointer; }
      .hdud-action-btn:hover { background: var(--hdud-hover); border-color: var(--hdud-border); opacity: 1; }
    `;
  }, []);

  const LoadingView = (
    <div className="hdud-page hdud-page-dashboard" style={{ height: "auto" }}>
      <div className="hdud-container hdud-container-dashboard" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <div className="hdud-card" style={{ padding: 18 }}>
          <div className="hdud-pagehead">
            <div style={{ minWidth: 0 }}>
              <h1 className="hdud-pagehead-title">Carregando seu universo…</h1>
              <p className="hdud-pagehead-subtitle" style={{ marginTop: 8 }}>
                Só um instante.
              </p>
            </div>
          </div>
        </div>

        <div className="hdud-card" style={{ marginTop: 14, padding: 18, opacity: 0.82 }}>
          Preparando ecossistema vivo, memórias e capítulos…
        </div>
      </div>
    </div>
  );

  const pageStyle: React.CSSProperties = {
    height: "auto",
    minHeight: 0,
    background: "transparent",
  };

  // mais “LinkedIn”: centro um pouco mais estreito/limpo
  const containerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 1460,
    margin: "0 auto",
    padding: isWide ? "12px 12px 28px" : "10px 12px 18px",
  };

  const stageGridStyle: React.CSSProperties = isWide
    ? {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 360px",
        gap: 20,
        alignItems: "start",
        marginTop: 12,
      }
    : {
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 12,
        alignItems: "start",
        marginTop: 12,
      };

  const rightStageStyle: React.CSSProperties = isWide
    ? { position: "sticky", top: 12, alignSelf: "start" }
    : { position: "static" };

  // Epicentro (compact bar)
  const epicentroBar: React.CSSProperties = {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-card)",
    borderRadius: 16,
    boxShadow: "var(--hdud-shadow-1)",
    padding: "12px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  };

  const pill: React.CSSProperties = {
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 850,
    opacity: 0.92,
    userSelect: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid var(--hdud-border)",
    background: "color-mix(in srgb, var(--hdud-surface-2) 94%, transparent)",
  };

  // Composer
  const composerWrapStyle: React.CSSProperties = {
    marginTop: 12,
    border: "1px solid var(--hdud-border)",
    borderRadius: 16,
    background: "var(--hdud-dash-composer-bg)",
    padding: 12,
    boxShadow: "var(--hdud-shadow-1)",
  };

  const composerTopRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "44px 1fr",
    gap: 12,
    alignItems: "center",
  };

  const composerInputStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    borderRadius: 999,
    padding: "12px 14px",
    fontSize: 13,
    fontWeight: 900,
    opacity: 0.98,
    cursor: "pointer",
    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
  };

  const composerActionsStyle: React.CSSProperties = {
    marginTop: 10,
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  };

  const composerActionBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid transparent",
    background: "transparent",
    fontWeight: 900,
    cursor: "pointer",
    opacity: 0.92,
    transition: "background 120ms ease, border-color 120ms ease",
  };

  function isWideSlot(index: number): boolean {
    const mod = index % 6;
    return mod === 0 || mod === 3;
  }

  const feedGridStyle: React.CSSProperties = isWide
    ? { display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12, marginTop: 12 }
    : { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 };

  const feedWideSpanStyle: React.CSSProperties = isWide ? { gridColumn: "span 12" } : {};
  const feedMediumSpanStyle: React.CSSProperties = isWide ? { gridColumn: "span 6" } : {};

  const feedCardBase: React.CSSProperties = {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface)",
    borderRadius: 16,
    padding: 14,
    textAlign: "left",
    width: "100%",
    transition: "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease",
    boxShadow: "var(--hdud-shadow-1)",
  };

  const featuredCardStyle: React.CSSProperties = {
    ...feedCardBase,
    padding: isWide ? 18 : 14,
    border: "1px solid var(--hdud-warn-border)",
    background: "color-mix(in srgb, var(--hdud-surface) 94%, var(--hdud-warn-bg))",
    boxShadow: "var(--hdud-shadow-1)",
  };

  const miniCard: React.CSSProperties = {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-card)",
    borderRadius: 16,
    padding: 12,
    transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
    boxShadow: "var(--hdud-shadow-0)",
  };

  const errorCard: React.CSSProperties = {
    border: "1px solid var(--hdud-warn-border)",
    background: "color-mix(in srgb, var(--hdud-card) 90%, var(--hdud-warn-bg))",
    borderRadius: 18,
    boxShadow: "var(--hdud-shadow-1)",
    marginTop: 12,
    padding: 16,
  };

  const newsTopics = useMemo(() => {
    const base = [
      "Autobiografias em alta em 2026",
      "Memórias como ativo digital",
      "IA para escrita: onde dá ruim",
      "Capítulos como mapa da vida",
      "Governança de identidade",
      "Como transformar histórias em legado",
    ];
    // determinístico por dia
    const k = Math.abs(hashStr(dayBand));
    const arr = [...base];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (k + i * 17) % (i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr.slice(0, 4);
  }, [dayBand]);

  return loading ? (
    LoadingView
  ) : (
    <div className="hdud-page hdud-page-dashboard" style={pageStyle}>
      <style>{styles}</style>

      <div className="hdud-container hdud-container-dashboard" style={containerStyle}>
        <div style={stageGridStyle}>
          {/* CENTER */}
          <div style={{ minWidth: 0 }}>
            {/* EPICENTRO (compact, não rouba palco) */}
            <section style={epicentroBar} aria-label="Epicentro ao vivo">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                <div style={{ ...pill, letterSpacing: 0.6, textTransform: "uppercase" }} title="Modo Epicentro">
                  ⚠️ EPICENTRO
                </div>

                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.78, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
                  O mundo é por dentro.
                </div>

                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 750, minWidth: 0 }}>
                  {epicentroLine}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <div style={pill} title="Ao vivo">
                  <span
                    className="hdud-pulse-dot"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: "var(--hdud-success-border)",
                      boxShadow: "var(--hdud-dash-live-dot-shadow)",
                    }}
                  />
                  ao vivo
                </div>

                <button
                  className="hdud-btn"
                  onClick={() => void load("refresh")}
                  disabled={refreshing}
                  style={{
                    borderRadius: 999,
                    padding: "9px 12px",
                    fontWeight: 900,
                    background: "var(--hdud-surface-2)",
                    border: "1px solid var(--hdud-border)",
                  }}
                  title="Atualizar pulso"
                >
                  {refreshing ? "Atualizando…" : "Atualizar"}
                </button>
              </div>

              <div style={{ width: "100%" }} className="hdud-subtle-divider" />

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={pill} title="Atividades publicadas nas últimas 24h">
                  <span style={{ fontWeight: 900 }}>🟢</span> {pulse.signals24h} sinais (24h)
                </div>
                <div style={pill} title="Memórias publicadas nas últimas 2h">
                  <span style={{ fontWeight: 900 }}>🔥</span> {pulse.stories2h} histórias (2h)
                </div>
                <div style={pill} title="Capítulos iniciados/atualizados hoje">
                  <span style={{ fontWeight: 900 }}>✍️</span> {pulse.chaptersToday} capítulos (hoje)
                </div>
              </div>
            </section>

            {/* COMPOSER (rei do centro) */}
            <section style={{ minWidth: 0 }}>
              <div style={composerWrapStyle}>
                <div style={composerTopRowStyle}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      border: "1px solid var(--hdud-border)",
                      background: "var(--hdud-surface-2)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      userSelect: "none",
                      boxShadow: "var(--hdud-shadow-0)",
                    }}
                    title={avatarAbs ? "Avatar" : "Sem avatar"}
                  >
                    {avatarAbs ? (
                      <img
                        src={avatarAbs}
                        alt="avatar"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={(e) => {
                          (e.currentTarget as any).style.display = "none";
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 14 }}>{initials}</div>
                    )}
                  </div>

                  <button className="hdud-btn hdud-composer-input" style={composerInputStyle} onClick={() => goMemories("text")} title="Começar publicação">
                    Começar publicação
                  </button>
                </div>

                <div style={composerActionsStyle}>
                  <button className="hdud-composer-action" style={composerActionBtnStyle} onClick={() => goMemories("text")} title="Memória">
                    <ComposerIcon name="text" />
                    Memória
                  </button>

                  <button className="hdud-composer-action" style={composerActionBtnStyle} onClick={() => goMemories("photo")} title="Foto">
                    <ComposerIcon name="photo" />
                    Foto
                  </button>

                  <button className="hdud-composer-action" style={composerActionBtnStyle} onClick={goChapters} title="Escrever capítulo">
                    <ComposerIcon name="article" />
                    Escrever capítulo
                  </button>

                  <div style={{ flex: 1 }} />
                </div>
              </div>

              {error ? (
                <div className="hdud-card" style={errorCard}>
                  <div style={{ fontWeight: 980, marginBottom: 6 }}>Falha ao carregar</div>
                  <div style={{ opacity: 0.85 }}>{error}</div>
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="hdud-btn hdud-btn-primary" onClick={() => void load("refresh")}>
                      Tentar novamente
                    </button>
                  </div>
                </div>
              ) : null}

              {/* FEED */}
              <div
                className="hdud-card"
                style={{
                  border: "1px solid var(--hdud-border)",
                  background: "var(--hdud-card)",
                  borderRadius: 16,
                  boxShadow: "var(--hdud-shadow-1)",
                  marginTop: 12,
                  padding: isWide ? 18 : 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950, fontSize: 14, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.92 }}>
                      O mundo já está acontecendo aqui
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78, fontWeight: 750 }}>
                      Pessoas reais. Histórias reais. Rede viva.
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <div className="hdud-seg" aria-label="Ordenação do feed">
                      <button data-active={feedMode === "top"} onClick={() => setFeedMode("top")} title="Principais (destaque + engajamento)">
                        Principais
                      </button>
                      <button data-active={feedMode === "recent"} onClick={() => setFeedMode("recent")} title="Recentes (por data)">
                        Recentes
                      </button>
                    </div>

                    <div style={pill} title="Itens no feed">
                      {organicItems.length} no feed
                    </div>
                  </div>
                </div>

                <div style={feedGridStyle}>
                  {organicItems.map((it, idx) => {
                    const wideSlot = isWideSlot(idx);
                    const spanStyle = wideSlot ? feedWideSpanStyle : feedMediumSpanStyle;

                    const isFeatured = it.emphasis === "featured";
                    const badgeLabel = it.atIso ? formatRelative(it.atIso) : idx === 0 ? "agora" : "";

                    const onOpen = () => {
                      if (it.kind === "chapter" && it.href === "/chapters") {
                        navigate("/chapters");
                        return;
                      }
                      if (it.kind === "memory" && it.href.startsWith("/memories/")) {
                        navigate(it.href);
                        return;
                      }
                      navigate(it.href);
                    };

                    const likes = it.likes ?? 0;
                    const comments = it.comments ?? 0;
                    const reposts = it.reposts ?? 0;
                    const saves = it.saves ?? 0;

                    return (
                      <div key={`org-${it.id}`} style={{ ...spanStyle }}>
                        <button
                          className="hdud-btn hdud-feed-card"
                          style={{
                            ...(isFeatured ? featuredCardStyle : feedCardBase),
                            cursor: "pointer",
                          }}
                          onClick={onOpen}
                          title={isFeatured ? "Destaque do momento" : "Abrir"}
                        >
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 950, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.92 }}>
                                {isFeatured ? "🔥 Destaque" : it.kind === "chapter" ? "Capítulo" : "Memória"}
                              </div>
                            </div>

                            {badgeLabel ? (
                              <div
                                style={{
                                  border: "1px solid var(--hdud-border)",
                                  background: "var(--hdud-surface-2)",
                                  borderRadius: 999,
                                  padding: "6px 10px",
                                  fontSize: 12,
                                  fontWeight: 850,
                                  opacity: 0.9,
                                  userSelect: "none",
                                  whiteSpace: "nowrap",
                                }}
                                title="tempo"
                              >
                                {badgeLabel}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ marginTop: 10, fontWeight: 980, fontSize: isFeatured ? 16 : 14, letterSpacing: -0.5, lineHeight: 1.14 }}>
                            {clampText(it.title, isFeatured ? 150 : 110)}
                          </div>

                          <div style={{ marginTop: 10, fontSize: 12.8, opacity: 0.84, fontWeight: 750, lineHeight: 1.42 }}>
                            {clampText(it.fragment, isFeatured ? 240 : 170)}
                          </div>

                          {/* linha social (LinkedIn vibe) */}
                          {it.socialHint ? (
                            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.74, fontWeight: 750 }}>
                              {it.socialHint}
                            </div>
                          ) : null}

                          {/* métricas */}
                          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, opacity: 0.76, fontWeight: 850 }}>
                              👍 {likes} • 💬 {comments} • ↻ {reposts} • 🔖 {saves}
                            </div>

                            <div style={{ fontSize: 12, opacity: 0.74, fontWeight: 850, whiteSpace: "nowrap" }}>
                              {it.atIso ? formatRelative(it.atIso) : isFeatured ? "agora" : ""}
                            </div>
                          </div>

                          <div style={{ marginTop: 10 }} className="hdud-subtle-divider" />

                          {/* ações (não navegam) */}
                          <div className="hdud-actions" aria-label="Ações do post">
                            <button
                              type="button"
                              className="hdud-action-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              title="Curtir"
                            >
                              <ActionIcon name="like" /> Curtir
                            </button>

                            <button
                              type="button"
                              className="hdud-action-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              title="Comentar"
                            >
                              <ActionIcon name="comment" /> Comentar
                            </button>

                            <button
                              type="button"
                              className="hdud-action-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              title="Repostar"
                            >
                              <ActionIcon name="repost" /> Repostar
                            </button>

                            <button
                              type="button"
                              className="hdud-action-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              title="Salvar"
                            >
                              <ActionIcon name="save" /> Salvar
                            </button>
                          </div>

                          <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontSize: 12, opacity: 0.88, fontWeight: 850, minWidth: 0 }}>
                              <span style={{ opacity: 0.65 }}>— </span>
                              <span style={{ opacity: 0.94 }}>{clampText(it.actor, 40)}</span>
                              <span style={{ opacity: 0.55 }}> </span>
                              <span style={{ opacity: 0.78 }}>{it.action}</span>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 14 }} className="hdud-subtle-divider" />

                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.78, fontWeight: 750, lineHeight: 1.35 }}>
                  Isto não é “conteúdo”. É registro.
                </div>

                {/* Mantém o componente “vivo”, mas agora como “rodapé” e não protagonista */}
                <div style={{ marginTop: 12, opacity: 0.92 }}>
                  <LivingEcosystem stories={seedStories()} />
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT */}
          <aside style={rightStageStyle}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={miniCard} className="hdud-mini-card">
                <div style={{ fontWeight: 950, fontSize: 12, letterSpacing: 0.9, textTransform: "uppercase", opacity: 0.92 }}>
                  Biblioteca rápida
                </div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78, fontWeight: 750 }}>
                  Um clique. Sem cerimônia.
                </div>

                <div style={{ marginTop: 12 }} className="hdud-subtle-divider" />

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 850, fontSize: 12, opacity: 0.92 }}>Memórias recentes</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {memoriesTop5.length ? (
                      memoriesTop5.map((m) => (
                        <button
                          key={`m-top-${m.source_id}`}
                          onClick={() => {
                            const nav = m?.meta?.nav;
                            if (nav) navigate(nav);
                            else openMemory(Number(m.source_id));
                          }}
                          className="hdud-btn hdud-mini-card hdud-rail-item"
                          style={{
                            border: "1px solid var(--hdud-border)",
                            background: "var(--hdud-surface)",
                            borderRadius: 14,
                            padding: 10,
                            textAlign: "left",
                            width: "100%",
                            boxShadow: "none",
                            transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
                          }}
                          title="Abrir memória"
                        >
                          <div style={{ fontWeight: 850, fontSize: 12, lineHeight: 1.2 }}>
                            {clampText(m.title, 70) || "(Memória sem título)"}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78, fontWeight: 750 }}>{formatRelative(m.date)}</div>
                        </button>
                      ))
                    ) : (
                      <div style={{ padding: 12, borderRadius: 14, border: "1px dashed var(--hdud-border)", opacity: 0.9 }}>
                        <div style={{ fontWeight: 980, marginBottom: 8 }}>Nenhuma memória ainda.</div>
                        <button className="hdud-btn hdud-btn-primary" onClick={() => navigate("/memories")}>
                          Registrar primeira memória
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 14 }} className="hdud-subtle-divider" />

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 850, fontSize: 12, opacity: 0.92 }}>Capítulos (mapa)</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {chaptersTop5.length ? (
                      chaptersTop5.map((c) => (
                        <button
                          key={`c-top-${c.source_id}`}
                          onClick={() => {
                            const id = (c?.meta as any)?.chapter_id ?? c.source_id;
                            openChapter(id);
                          }}
                          className="hdud-btn hdud-mini-card hdud-rail-item"
                          style={{
                            border: "1px solid var(--hdud-border)",
                            background: "var(--hdud-surface)",
                            borderRadius: 14,
                            padding: 10,
                            textAlign: "left",
                            width: "100%",
                            boxShadow: "none",
                            transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
                          }}
                          title="Abrir capítulo"
                        >
                          <div style={{ fontWeight: 850, fontSize: 12, lineHeight: 1.2 }}>
                            {clampText(c.title, 70) || "(Capítulo sem título)"}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78, fontWeight: 750 }}>{formatRelative(c.date)}</div>
                        </button>
                      ))
                    ) : (
                      <div style={{ padding: 12, borderRadius: 14, border: "1px dashed var(--hdud-border)", opacity: 0.9 }}>
                        <div style={{ fontWeight: 980, marginBottom: 8 }}>Seu mapa ainda está vazio.</div>
                        <button className="hdud-btn hdud-btn-primary" onClick={() => navigate("/chapters")}>
                          Criar primeiro capítulo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* NOTÍCIAS (LinkedIn-ish) */}
              <div style={miniCard} className="hdud-mini-card">
                <div style={{ fontWeight: 950, fontSize: 12, letterSpacing: 0.9, textTransform: "uppercase", opacity: 0.92 }}>
                  HDUD Notícias
                </div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78, fontWeight: 750 }}>
                  Assuntos em alta.
                </div>

                <div style={{ marginTop: 12 }} className="hdud-subtle-divider" />

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {newsTopics.map((t) => (
                    <div
                      key={`topic-${t}`}
                      style={{
                        padding: 10,
                        borderRadius: 14,
                        border: "1px solid var(--hdud-border)",
                        background: "var(--hdud-surface)",
                      }}
                    >
                      <div style={{ fontWeight: 900, fontSize: 12, lineHeight: 1.25 }}>
                        {t}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, fontWeight: 750 }}>
                        {formatRelative(new Date(Date.now() - (Math.abs(hashStr(t)) % (18 * 60 * 60 * 1000))).toISOString())}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="hdud-btn"
                  style={{
                    marginTop: 12,
                    width: "100%",
                    borderRadius: 14,
                    padding: "10px 12px",
                    fontWeight: 900,
                    background: "var(--hdud-surface-2)",
                    border: "1px solid var(--hdud-border)",
                  }}
                  onClick={() => {}}
                  title="Exibir mais"
                >
                  Exibir mais →
                </button>
              </div>

              <div style={miniCard} className="hdud-mini-card">
                <div style={{ fontSize: 13, fontWeight: 980, lineHeight: 1.2, letterSpacing: -0.3 }}>
                  Identidade é ativo.
                  <br />
                  Registro é poder.
                </div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78, fontWeight: 750 }}>
                  O HDUD trata memória como infraestrutura.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}