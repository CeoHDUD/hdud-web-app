// C:\HDUD_DATA\hdud-web-app\src\pages\TimelinePage.tsx

import React, { useEffect, useMemo, useState } from "react";

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
// Auth / API helpers
// =====================
function tryExtractTokenFromValue(v: string): string | null {
  const s = (v || "").trim();
  if (!s) return null;

  // JWT típico
  if (s.split(".").length === 3) return s;

  // Às vezes salvam JSON no localStorage
  try {
    const obj = JSON.parse(s);
    const candidates = [
      obj?.access_token,
      obj?.token,
      obj?.jwt,
      obj?.data?.access_token,
      obj?.data?.token,
    ];
    for (const t of candidates) {
      if (typeof t === "string" && t.trim().split(".").length === 3) return t.trim();
    }
  } catch {
    // ignore
  }

  return null;
}

function getAuthToken(): string | null {
  // chaves conhecidas + comuns em apps
  const candidates = [
    "access_token",
    "token",
    "hdud_token",
    "HDUD_TOKEN",
    "auth_token",
    "jwt",
    "id_token",
    "session_token",
    "hdud.access_token",
    "hdud.token",
    "hdud.auth",
    "auth",
  ];

  for (const k of candidates) {
    const v = window.localStorage.getItem(k);
    if (!v) continue;

    const token = tryExtractTokenFromValue(v);
    if (token) return token;
  }

  // fallback: varrer localStorage por algo que pareça JWT
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const v = window.localStorage.getItem(key) || "";
      const token = tryExtractTokenFromValue(v);
      if (token) return token;
    }
  } catch {
    // ignore
  }

  return null;
}

function getApiBase(): string {
  const env = (import.meta as any).env || {};
  const base =
    env.VITE_API_BASE ||
    env.VITE_API_URL ||
    env.VITE_BACKEND_URL ||
    env.VITE_API ||
    "";
  return String(base || "").trim().replace(/\/+$/, "");
}

function normalizeUrl(path: string): string {
  const base = getApiBase();
  if (!path.startsWith("/")) path = `/${path}`;
  return base ? `${base}${path}` : path;
}

async function fetchTimeline(
  token: string | null
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  usedUrl: string;
  authSent: boolean;
}> {
  const usedUrl = normalizeUrl("/timeline");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authSent = Boolean(token);

  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(usedUrl, { headers });
  const text = await r.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: r.ok, status: r.status, data, usedUrl, authSent };
}

// =====================
// Date / formatting
// =====================
function safeDateParse(value: string): Date | null {
  if (!value) return null;
  const d1 = new Date(value);
  if (!isNaN(d1.getTime())) return d1;

  const d2 = new Date(String(value).replace(" ", "T"));
  if (!isNaN(d2.getTime())) return d2;

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

function KindPill({ kind }: { kind: TimelineKind }) {
  // sem “inventar paleta”: só hierarquia/forma
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
        active
          ? "font-semibold opacity-100 shadow-sm"
          : "opacity-70 hover:opacity-90",
      ].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

// =====================
// Page
// =====================
export default function TimelinePage() {
  const filters: FilterKey[] = ["Tudo", "Memórias", "Capítulos", "Versões", "Rollbacks"];

  const [activeFilter, setActiveFilter] = useState<FilterKey>("Tudo");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // debug/telemetria leve (pra nunca ficar no escuro)
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    usedUrl: string;
    authSent: boolean;
    httpStatus: number | null;
    tokenPresent: boolean;
  }>({
    usedUrl: normalizeUrl("/timeline"),
    authSent: false,
    httpStatus: null,
    tokenPresent: Boolean(getAuthToken()),
  });

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    const token = getAuthToken();

    try {
      const { ok, status, data, usedUrl, authSent } = await fetchTimeline(token);

      setDebugInfo({
        usedUrl,
        authSent,
        httpStatus: status,
        tokenPresent: Boolean(token),
      });

      if (!ok) {
        const detail =
          typeof data === "object" && data
            ? data?.detail || data?.error || JSON.stringify(data)
            : String(data);

        setErrorMsg(`Falha ao carregar timeline (HTTP ${status}). ${detail || ""}`.trim());
        setEvents([]);
        setWarnings([]);
        setLoading(false);
        return;
      }

      const payload = data as TimelineResponse;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const warns = Array.isArray(payload?.warnings) ? payload.warnings : [];

      setEvents(items.sort(sortEventsDesc));
      setWarnings(warns);
      setLastUpdated(new Date());
    } catch (e: any) {
      setErrorMsg("Falha de rede ao carregar timeline. Verifique API e token.");
      setEvents([]);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load();
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEvents = useMemo(() => {
    if (activeFilter === "Tudo") return events;
    if (activeFilter === "Memórias") return events.filter((e) => e.kind === "Memória");
    if (activeFilter === "Capítulos") return events.filter((e) => e.kind === "Capítulo");
    if (activeFilter === "Versões") return events.filter((e) => e.kind === "Versão");
    if (activeFilter === "Rollbacks") return events.filter((e) => e.kind === "Rollback");
    return events;
  }, [events, activeFilter]);

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
      list: list.sort(sortEventsDesc),
      sortKey:
        day === "Sem data"
          ? -Infinity
          : safeDateParse(list[0]?.at)?.getTime() ?? -Infinity,
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

  return (
    <div className="hdud-page space-y-4">
      {/* Hero / Header */}
      <div className="hdud-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="hdud-title">Timeline</h1>
            <p className="hdud-subtitle">
              Uma linha do tempo única do que aconteceu na sua história — memórias, capítulos e (em breve) versões, diffs e rollbacks —
              consumindo apenas o core (<code>/timeline</code>).
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs opacity-80">
                Status: <span className="ml-1 font-medium opacity-100">{statusLine}</span>
                {lastUpdated && !loading && !errorMsg ? (
                  <span className="ml-2 opacity-80">
                    • Atualizado:{" "}
                    <span className="font-medium">
                      {lastUpdated.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
                    <span className="font-medium">
                      {debugInfo.httpStatus === null ? "—" : debugInfo.httpStatus}
                    </span>
                  </div>
                  <div className="mt-2 opacity-70">
                    Se o token estiver ausente, a Timeline pode voltar vazia ou sem acesso dependendo do core.
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

      {/* Filters */}
      <div className="hdud-card">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-lg font-semibold">Filtros</div>
            <div className="text-sm opacity-80">
              Visualize por tipo mantendo a timeline <span className="font-medium">unificada</span> e <span className="font-medium">cronológica</span>.
            </div>
          </div>

          <div className="text-xs opacity-70 md:text-right">
            <div className="inline-flex items-center rounded-full border px-3 py-1">
              Itens: <span className="ml-1 font-medium">{events.length}</span>
            </div>
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

      {/* Events (Investor-grade: timeline vertical) */}
      <div className="hdud-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Eventos</div>
            <div className="text-sm opacity-80">
              Do mais recente para o mais antigo, agrupados por dia (timeline viva).
            </div>
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
                Dica: confirme que você está logado e que existe token no <code>localStorage</code>.
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="mt-4 rounded-xl border px-5 py-4 text-sm opacity-80">
            Carregando eventos…
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="mt-4 rounded-xl border px-5 py-4">
            <div className="text-sm font-semibold">Nada para mostrar neste filtro</div>
            <div className="mt-1 text-sm opacity-80">
              Crie uma memória ou capítulo (ou ajuste o filtro) para a timeline ganhar vida.
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

                      return (
                        <div key={it.id} className="relative pl-10">
                          {/* dot */}
                          <div
                            className="absolute left-[9px] top-4 h-[12px] w-[12px] rounded-full border bg-white"
                            aria-hidden="true"
                          />

                          <div className="rounded-xl border px-4 py-3 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-xs opacity-70">{time}</div>
                                <div className="mt-0.5 text-base font-semibold leading-6">
                                  {it.title}
                                </div>
                                {note ? (
                                  <div className="mt-1 text-sm opacity-80">{note}</div>
                                ) : null}

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs opacity-65">
                                  <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                                    Fonte: {it.source || "unknown"}
                                  </span>
                                  <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                                    ID: {it.id}
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 pt-1">
                                <KindPill kind={it.kind} />
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
          Observação: esta tela <span className="font-semibold">apenas consome</span> o endpoint unificado{" "}
          <code>/timeline</code>. Versões/diff/rollback entram quando o core expuser esses eventos.
        </div>
      </div>
    </div>
  );
}
