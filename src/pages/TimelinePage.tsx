// C:\HDUD_DATA\hdud-web-app\src\pages\TimelinePage.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type TimelineKind = "Memória" | "Capítulo" | "Versão" | "Rollback" | "Evento";

type TimelineEvent = {
  id: string;
  at: string;
  title: string;
  kind: TimelineKind;
  note?: string;
  source?: "memories" | "chapters" | "versions" | "ledger" | "unknown";
  raw?: any;
};

type TimelineResponse = {
  ok: boolean;
  items?: TimelineEvent[];
  warnings?: string[];
  meta?: any;
};

type FilterKey = "Tudo" | "Memórias" | "Capítulos" | "Versões" | "Rollbacks";

// =====================
// Auth / API helpers (MVP)
// =====================
const API_BASE = "/api";

// Mantém compat com as chaves que já apareceram nos testes
function getTokenFromStorage(): string | null {
  return (
    window.localStorage.getItem("HDUD_TOKEN") ||
    window.localStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    null
  );
}

async function readJsonOrText(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.text();
  } catch {
    return null;
  }
}

function messageFromErrorPayload(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  return payload?.detail || payload?.error || payload?.message || null;
}

async function fetchTimeline(token: string | null, signal?: AbortSignal) {
  const url = `${API_BASE}/timeline`;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store", signal });

  if (!res.ok) {
    const payload = await readJsonOrText(res);
    const msg = messageFromErrorPayload(payload) || `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    err.url = url;
    throw err;
  }

  const payload = (await readJsonOrText(res)) as TimelineResponse | any;
  return { url, payload };
}

// =====================
// Date / formatting
// =====================
function safeDateParse(value: string): Date | null {
  if (!value) return null;
  const d1 = new Date(value);
  if (!Number.isNaN(d1.getTime())) return d1;

  const d2 = new Date(String(value).replace(" ", "T"));
  if (!Number.isNaN(d2.getTime())) return d2;

  return null;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function sortEventsDesc(a: TimelineEvent, b: TimelineEvent) {
  const da = safeDateParse(a.at)?.getTime() ?? -Infinity;
  const db = safeDateParse(b.at)?.getTime() ?? -Infinity;
  return db - da;
}

function clampText(s: string, max = 160) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

// =====================
// UX small atoms
// =====================
function KindPill({ kind }: { kind: TimelineKind }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium opacity-90">
      {kind}
    </span>
  );
}

function ChipButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
        active ? "font-semibold opacity-100 shadow-sm" : "opacity-70 hover:opacity-90",
      ].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

// =====================
// Helpers: navigation target extraction (MVP)
// =====================
function extractNumberFromAny(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractMemoryId(ev: TimelineEvent): number | null {
  const raw = ev.raw || {};

  // 1) Preferencial: campos explícitos (quando o agregador expõe)
  const direct =
    extractNumberFromAny(raw?.memory_id) ??
    extractNumberFromAny(raw?.memoryId) ??
    extractNumberFromAny(raw?.memoryID) ??
    extractNumberFromAny(raw?.id_memory) ??
    extractNumberFromAny(raw?.entity_id) ??
    extractNumberFromAny(raw?.entityId) ??
    extractNumberFromAny(raw?.source_id) ??
    extractNumberFromAny(raw?.sourceId);

  if (direct != null) return direct;

  // 2) Se o próprio "id" do evento for numérico
  const asId = extractNumberFromAny(ev.id);
  if (asId != null) return asId;

  // 3) Heurística: tentar achar número em "id" ou "title" (ex: "memory:79", "#79", "Memória 79")
  const joined = `${ev.id || ""} ${ev.title || ""}`.trim();
  const m = joined.match(/(?:#|memory:|memoria:|memória:|memoria\s+|memória\s+)?(\d{1,9})\b/i);
  if (m?.[1]) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

// =====================
// Page
// =====================
export default function TimelinePage() {
  const nav = useNavigate();

  const filters: FilterKey[] = ["Tudo", "Memórias", "Capítulos", "Versões", "Rollbacks"];

  const [activeFilter, setActiveFilter] = useState<FilterKey>("Tudo");
  const [q, setQ] = useState(""); // ✅ search MVP
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // debug leve (pra nunca ficar no escuro)
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    usedUrl: string;
    authSent: boolean;
    httpStatus: number | null;
    tokenPresent: boolean;
  }>({
    usedUrl: `${API_BASE}/timeline`,
    authSent: false,
    httpStatus: null,
    tokenPresent: Boolean(getTokenFromStorage()),
  });

  // guards anti-concorrência + anti-StrictMode double fire
  const inflightRef = useRef(false);
  const seqRef = useRef(0);
  const lastLoadedKeyRef = useRef<string>(""); // key por token presence
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;

    const mySeq = ++seqRef.current;

    setLoading(true);
    setErrorMsg(null);

    const token = getTokenFromStorage();

    // abort request anterior (se houver)
    try {
      abortRef.current?.abort();
    } catch {
      // ignore
    }
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const { url, payload } = await fetchTimeline(token, ac.signal);

      // stale guard
      if (mySeq !== seqRef.current) return;

      const items = Array.isArray(payload?.items) ? (payload.items as TimelineEvent[]) : [];
      const warns = Array.isArray(payload?.warnings) ? (payload.warnings as string[]) : [];

      setEvents(items.slice().sort(sortEventsDesc));
      setWarnings(warns);
      setLastUpdated(new Date());

      setDebugInfo({
        usedUrl: url,
        authSent: Boolean(token),
        httpStatus: 200,
        tokenPresent: Boolean(token),
      });
    } catch (e: any) {
      // stale guard
      if (mySeq !== seqRef.current) return;

      if (e?.name === "AbortError") {
        // request cancelada (normal)
        return;
      }

      const status = e?.status ?? null;
      setDebugInfo({
        usedUrl: e?.url || `${API_BASE}/timeline`,
        authSent: Boolean(getTokenFromStorage()),
        httpStatus: status,
        tokenPresent: Boolean(getTokenFromStorage()),
      });

      const msg = e?.message || "Falha de rede ao carregar timeline.";
      setErrorMsg(status ? `Falha ao carregar timeline (HTTP ${status}). ${msg}` : msg);
      setEvents([]);
      setWarnings([]);
    } finally {
      if (mySeq === seqRef.current) setLoading(false);
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    // ✅ Anti-duplicação StrictMode (DEV): mesma “sessão/token presence” não dispara 2x
    const key = `timeline|token:${Boolean(getTokenFromStorage())}`;
    if (lastLoadedKeyRef.current === key) return;
    lastLoadedKeyRef.current = key;

    load();

    return () => {
      try {
        abortRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, [load]);

  const filteredEvents = useMemo(() => {
    const base =
      activeFilter === "Tudo"
        ? events
        : activeFilter === "Memórias"
          ? events.filter((e) => e.kind === "Memória")
          : activeFilter === "Capítulos"
            ? events.filter((e) => e.kind === "Capítulo")
            : activeFilter === "Versões"
              ? events.filter((e) => e.kind === "Versão")
              : activeFilter === "Rollbacks"
                ? events.filter((e) => e.kind === "Rollback")
                : events;

    const qs = q.trim().toLowerCase();
    if (!qs) return base;

    return base.filter((e) => {
      const hay = `${e.title || ""} ${e.note || ""} ${e.kind || ""} ${e.source || ""} ${e.id || ""}`.toLowerCase();
      return hay.includes(qs);
    });
  }, [events, activeFilter, q]);

  const counts = useMemo(() => {
    return {
      Tudo: events.length,
      Memórias: events.filter((e) => e.kind === "Memória").length,
      Capítulos: events.filter((e) => e.kind === "Capítulo").length,
      Versões: events.filter((e) => e.kind === "Versão").length,
      Rollbacks: events.filter((e) => e.kind === "Rollback").length,
    };
  }, [events]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();

    for (const ev of filteredEvents) {
      const d = safeDateParse(ev.at);
      const key = d ? formatDayLabel(d) : "Sem data";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }

    const entries = Array.from(map.entries()).map(([day, list]) => ({
      day,
      list: list.slice().sort(sortEventsDesc),
      sortKey: day === "Sem data" ? -Infinity : safeDateParse(list[0]?.at)?.getTime() ?? -Infinity,
    }));

    entries.sort((a, b) => b.sortKey - a.sortKey);
    return entries;
  }, [filteredEvents]);

  const statusLine = useMemo(() => {
    if (loading) return "Carregando…";
    if (errorMsg) return "Erro";
    return "Ativo";
  }, [loading, errorMsg]);

  const tokenBadge = useMemo(() => {
    const ok = debugInfo.tokenPresent;
    return (
      <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium opacity-90">
        <span className="inline-block h-2 w-2 rounded-full border" aria-hidden="true" />
        Token: {ok ? "detectado" : "ausente"}
      </span>
    );
  }, [debugInfo.tokenPresent]);

  const canOpenMemory = useCallback((ev: TimelineEvent) => {
    // MVP: abrimos Memória (e versões/rollback se tiver memory_id)
    if (ev.kind === "Memória") return extractMemoryId(ev) != null;
    if (ev.kind === "Versão" || ev.kind === "Rollback") return extractMemoryId(ev) != null;
    return false;
  }, []);

  const openMemory = useCallback(
    (ev: TimelineEvent) => {
      const mid = extractMemoryId(ev);
      if (!mid) return;
      nav(`/memories/${mid}`);
    },
    [nav]
  );

  return (
    <div className="hdud-page space-y-4">
      {/* Header */}
      <div className="hdud-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="hdud-title">Timeline</h1>
            <p className="hdud-subtitle">
              Linha do tempo unificada do que aconteceu na sua história — consumindo apenas o core{" "}
              <code>{API_BASE}/timeline</code>.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs opacity-80">
                Status: <span className="ml-1 font-medium opacity-100">{statusLine}</span>
                {lastUpdated && !loading && !errorMsg ? (
                  <span className="ml-2 opacity-80">
                    • Atualizado:{" "}
                    <span className="font-medium">
                      {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                ) : null}
              </span>

              {tokenBadge}

              <button
                type="button"
                onClick={() => setDebugOpen((v) => !v)}
                className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium opacity-80 hover:opacity-100"
              >
                {debugOpen ? "Ocultar diagnóstico" : "Diagnóstico"}
              </button>
            </div>

            {debugOpen && (
              <div className="mt-3 rounded-lg border px-4 py-3 text-xs opacity-80">
                <div className="font-semibold opacity-90">Diagnóstico rápido</div>
                <div className="mt-2 space-y-1">
                  <div>
                    • Endpoint: <span className="font-medium">{debugInfo.usedUrl}</span>
                  </div>
                  <div>
                    • Authorization enviado:{" "}
                    <span className="font-medium">{debugInfo.authSent ? "sim" : "não"}</span>
                  </div>
                  <div>
                    • HTTP:{" "}
                    <span className="font-medium">{debugInfo.httpStatus === null ? "—" : debugInfo.httpStatus}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-semibold opacity-90 hover:opacity-100 shadow-sm"
              disabled={loading}
              aria-disabled={loading}
              title="Recarregar timeline"
            >
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="hdud-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-lg font-semibold">Filtros</div>
            <div className="text-sm opacity-80">Timeline unificada e cronológica, com recorte por tipo.</div>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs opacity-70">
              Itens: <span className="ml-1 font-medium">{events.length}</span>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título, nota, tipo…"
              className="w-full md:w-[320px] rounded-md border px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((f) => {
            const isActive = f === activeFilter;
            const count =
              f === "Tudo"
                ? counts.Tudo
                : f === "Memórias"
                  ? counts.Memórias
                  : f === "Capítulos"
                    ? counts.Capítulos
                    : f === "Versões"
                      ? counts.Versões
                      : counts.Rollbacks;

            return (
              <ChipButton key={f} active={isActive} onClick={() => setActiveFilter(f)}>
                <span>{f}</span>
                <span className="inline-flex min-w-[30px] justify-center rounded-full border px-2 py-0.5 text-xs opacity-80">
                  {count}
                </span>
              </ChipButton>
            );
          })}
        </div>

        {warnings.length > 0 && (
          <div className="mt-4 rounded-lg border px-4 py-3 text-xs opacity-80">
            <div className="font-semibold opacity-90">Avisos do agregador</div>
            <div className="mt-2 space-y-1">
              {warnings.slice(0, 8).map((w, i) => (
                <div key={`warn-${i}`}>• {w}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Events */}
      <div className="hdud-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Eventos</div>
            <div className="text-sm opacity-80">Mais recente → mais antigo, agrupado por dia.</div>
          </div>
          <div className="text-xs opacity-70">{loading ? "Carregando..." : "Ativo"}</div>
        </div>

        {/* Error / Loading / Empty */}
        {errorMsg ? (
          <div className="mt-4 rounded-xl border px-5 py-4">
            <div className="text-sm font-semibold">Não foi possível carregar a Timeline</div>
            <div className="mt-1 text-sm opacity-80">{errorMsg}</div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-semibold opacity-90 hover:opacity-100 shadow-sm"
              >
                Tentar novamente
              </button>
              <div className="text-xs opacity-70">
                Dica: confirme login/token e que o backend está respondendo em <code>{API_BASE}</code>.
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="mt-4 rounded-xl border px-5 py-4 text-sm opacity-80">Carregando eventos…</div>
        ) : filteredEvents.length === 0 ? (
          <div className="mt-4 rounded-xl border px-5 py-4">
            <div className="text-sm font-semibold">Nada para mostrar</div>
            <div className="mt-1 text-sm opacity-80">
              Crie uma memória/capítulo (ou ajuste filtros/busca) para a timeline ganhar vida.
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-8">
            {grouped.map((g) => (
              <section key={g.day} className="space-y-4">
                {/* Day Header */}
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide opacity-85">
                    {g.day}
                  </div>
                  <div className="h-px flex-1 border-t opacity-60" />
                </div>

                {/* Timeline list */}
                <div className="relative">
                  <div className="absolute left-[14px] top-0 h-full border-l opacity-40" aria-hidden="true" />

                  <div className="space-y-3">
                    {g.list.map((it) => {
                      const dt = safeDateParse(it.at);
                      const time = dt ? formatTimeLabel(dt) : it.at;
                      const note = it.note ? clampText(it.note, 220) : "";

                      const openable = canOpenMemory(it);
                      const mid = openable ? extractMemoryId(it) : null;

                      return (
                        <div key={it.id} className="relative pl-10">
                          {/* dot */}
                          <div
                            className="absolute left-[9px] top-4 h-[12px] w-[12px] rounded-full border bg-white"
                            aria-hidden="true"
                          />

                          <div
                            className={[
                              "rounded-xl border px-4 py-3 shadow-sm",
                              openable ? "cursor-pointer hover:opacity-95" : "",
                            ].join(" ")}
                            onClick={() => {
                              if (openable) openMemory(it);
                            }}
                            role={openable ? "button" : undefined}
                            tabIndex={openable ? 0 : -1}
                            onKeyDown={(e) => {
                              if (!openable) return;
                              if (e.key === "Enter" || e.key === " ") openMemory(it);
                            }}
                            aria-label={openable ? `Abrir memória ${mid ?? ""}` : undefined}
                            title={openable ? `Abrir /memories/${mid}` : undefined}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-xs opacity-70">{time}</div>
                                <div className="mt-0.5 text-base font-semibold leading-6">{it.title}</div>

                                {note ? <div className="mt-1 text-sm opacity-80">{note}</div> : null}

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs opacity-65">
                                  <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                                    Fonte: {it.source || "unknown"}
                                  </span>
                                  <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                                    ID: {it.id}
                                  </span>

                                  {openable && mid != null && (
                                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 font-semibold">
                                      Abrir: /memories/{mid}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 pt-1 flex flex-col items-end gap-2">
                                <KindPill kind={it.kind} />

                                {openable && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openMemory(it);
                                    }}
                                    className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold opacity-90 hover:opacity-100 shadow-sm"
                                  >
                                    Abrir
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-lg border px-4 py-3 text-xs opacity-75">
          Observação: esta tela <span className="font-semibold">apenas consome</span> <code>{API_BASE}/timeline</code>.
          Se o agregador ainda não emitir versões/rollbacks, elas aparecem conforme o core passar a expor esses eventos.
        </div>
      </div>
    </div>
  );
}
