// C:\HDUD_DATA\hdud-web-app\src\pages\FeedPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ComingSoonPanel from "../components/ComingSoonPanel";
import {
  buildFeedSnapshot,
  fetchAuthorChapters,
  fetchAuthorMemories,
  type FeedSnapshot,
} from "../services/feed.service";

// ✅ Compat: cobre chaves antigas + chave oficial atual
function getToken(): string | null {
  return (
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("access_token") ||
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

function FeedList({
  items,
  emptyText,
  loading,
  loadingLines = 3,
}: {
  items: string[] | null;
  emptyText: string;
  loading: boolean;
  loadingLines?: number;
}) {
  if (loading) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {Array.from({ length: loadingLines }).map((_, i) => (
          <div
            key={`sk-${i}`}
            className="hdud-card"
            style={{
              padding: 12,
              opacity: 0.85,
            }}
          >
            <div style={{ height: 12, width: "72%", background: "var(--hdud-surface-2)", borderRadius: 8 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!items) return <div style={{ fontSize: 13, opacity: 0.7 }}>Entre para ver seu feed.</div>;
  if (items.length === 0) return <div style={{ fontSize: 13, opacity: 0.7 }}>{emptyText}</div>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((label, idx) => (
        <div key={`${label}-${idx}`} className="hdud-card" style={{ padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function FeedPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FeedSnapshot | null>(null);

  // ✅ token/authorId NÃO congelados
  const token = getToken();
  const authorId = getAuthorIdFromToken(token) ?? 1; // fallback seguro (não quebra demo)

  // ✅ request guard (evita “flash” de respostas velhas)
  const seqRef = useRef(0);

  async function load() {
    const seq = ++seqRef.current;

    setError(null);

    const t = getToken();
    if (!t) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const aId = getAuthorIdFromToken(t) ?? authorId;

      const [memories, chapters] = await Promise.all([
        fetchAuthorMemories(t, aId),
        fetchAuthorChapters(t, aId),
      ]);

      if (seq !== seqRef.current) return;

      const snap = buildFeedSnapshot(memories, chapters.length);
      setSnapshot(snap);
    } catch (e: any) {
      if (seq !== seqRef.current) return;
      setSnapshot(null);
      setError(e?.message ?? "Falha ao carregar seu Feed.");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // quando token muda, recarrega

  const storySoFarText = useMemo(() => {
    if (!snapshot) return null;
    const m = snapshot.counts.memoriesTotal ?? 0;
    const c = snapshot.counts.chaptersTotal ?? 0;
    return `Sua história até agora: ${m} memórias · ${c} capítulos`;
  }, [snapshot]);

  const movementItems = useMemo(() => {
    if (!snapshot) return null;
    if (!snapshot.recentMemories?.length) return [];

    return snapshot.recentMemories.map((m) => {
      const title = m.title || "(sem título)";
      const when = formatTimeAgoPtBR(m.created_at);
      const action = (m.version_number ?? 1) > 1 ? "Memória editada" : "Memória criada";
      return `Memória · ${action} · ${title} · ${when}`;
    });
  }, [snapshot]);

  const headerName = "Alexandre Neves"; // MVP: depois vem do /me/profile

  const hintMovement = useMemo(() => {
    if (loading) return "Atualizando…";
    if (!token) return "Entre para ver";
    if (snapshot) return "Atualizado";
    return "Em breve";
  }, [loading, token, snapshot]);

  const hintSoFar = useMemo(() => {
    if (loading) return "Atualizando…";
    if (!token) return "Entre para ver";
    if (snapshot) return "Atualizado";
    return "Em breve";
  }, [loading, token, snapshot]);

  return (
    <div className="hdud-page">
      <div className="hdud-container" style={{ margin: "0 auto" }}>
        <div className="hdud-card">
          <div className="hdud-pagehead">
            <div style={{ minWidth: 0 }}>
              <h1 className="hdud-pagehead-title">Seu presente narrativo</h1>
              <p className="hdud-pagehead-subtitle">O que está vivo agora na sua história.</p>

              <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{headerName}</div>
                <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 700 }}>
                  Autor • HDUD{authorId ? <span style={{ opacity: 0.6 }}> • id {authorId}</span> : null}
                </div>
                {storySoFarText ? (
                  <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>{storySoFarText}</div>
                ) : null}
              </div>
            </div>

            <div className="hdud-actions">
              {!token ? (
                <button
                  className="hdud-btn hdud-btn-primary"
                  onClick={() => navigate("/login")}
                  title="Entrar"
                >
                  Entrar
                </button>
              ) : (
                <button
                  className="hdud-btn"
                  onClick={() => {
                    if (loading) return;
                    void load();
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
              <div style={{ fontWeight: 900, marginBottom: 4 }}>Não consegui abrir seu Feed</div>
              <div style={{ opacity: 0.85 }}>{error}</div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="hdud-btn hdud-btn-primary"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  Tentar novamente
                </button>
                <button className="hdud-btn" onClick={() => navigate("/chapters")}>
                  Ir para Capítulos
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

        <div
          style={{
            display: "grid",
            gap: 14,
            marginTop: 14,
            gridTemplateColumns: "1fr 1fr",
          }}
          className="hdud-grid-2"
        >
          <ComingSoonPanel
            title="Em movimento"
            subtitle="O que evoluiu recentemente na sua história."
            hint={hintMovement}
          >
            <FeedList
              items={movementItems}
              loading={loading}
              emptyText="Nenhuma atividade recente ainda. Crie ou edite uma memória para o feed ganhar vida."
              loadingLines={3}
            />
          </ComingSoonPanel>

          <ComingSoonPanel
            title="Sua história até agora"
            subtitle="Um lembrete leve da sua jornada até aqui."
            hint={hintSoFar}
          >
            <FeedList
              items={storySoFarText ? [storySoFarText] : token ? [] : null}
              loading={loading}
              emptyText="Ainda não há números para mostrar. Comece criando uma memória ou um capítulo."
              loadingLines={2}
            />
          </ComingSoonPanel>
        </div>
      </div>
    </div>
  );
}
