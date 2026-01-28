// C:\HDUD_DATA\hdud-web-app\src\pages\FeedPage.tsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ComingSoonPanel from "../components/ComingSoonPanel";
import {
  buildFeedSnapshot,
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

function Badge({
  label,
}: {
  label: "real" | "placeholder" | "sugestão";
}) {
  const className =
    label === "real"
      ? "hdud-badge hdud-badge--real"
      : label === "sugestão"
      ? "hdud-badge hdud-badge--suggestion"
      : "hdud-badge hdud-badge--placeholder";

  return <span className={className}>{label}</span>;
}

function PlaceholderList({
  items,
  badgeLabel = "placeholder",
  onItemClick,
}: {
  items: string[];
  badgeLabel?: "real" | "placeholder" | "sugestão";
  onItemClick?: (index: number) => void;
}) {
  return (
    <ul>
      {items.map((label, idx) => (
        <li
          key={`${label}-${idx}`}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
          onClick={onItemClick ? () => onItemClick(idx) : undefined}
        >
          {label}
          <Badge label={badgeLabel} />
        </li>
      ))}
    </ul>
  );
}

function formatDateCompactPtBR(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

export default function FeedPage() {
  const authorId = 1;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FeedSnapshot | null>(null);

  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setError(null);

      if (!token) {
        setSnapshot(null);
        return;
      }

      setLoading(true);
      try {
        const memories = await fetchAuthorMemories(token, authorId);
        const snap = buildFeedSnapshot(memories);
        if (alive) setSnapshot(snap);
      } catch (e: any) {
        if (alive) {
          setSnapshot(null);
          setError(e?.message ?? "Falha ao carregar dados do Feed.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [token, authorId]);

  const weekItems = useMemo(() => {
    if (!snapshot) return null;
    return [
      `${snapshot.counts.memoriesTotal} memórias criadas`,
      `${snapshot.counts.versionsTotal} versões registradas`,
      `${snapshot.counts.rollbacksTotal} rollbacks aplicados`,
      `${snapshot.counts.chaptersTotal} capítulos atualizados`,
    ];
  }, [snapshot]);

  const recentItems = useMemo(() => {
    if (!snapshot) return null;
    if (!snapshot.recentMemories?.length) return [];
    return snapshot.recentMemories.map(
      (m) =>
        `${m.title} · v${m.version_number} · ${formatDateCompactPtBR(
          m.created_at
        )}`
    );
  }, [snapshot]);

  const onboardingSuggestions = useMemo(() => {
    if (!snapshot) {
      return [
        "Criar sua primeira memória",
        "Escolher seus capítulos iniciais",
        "Explorar a Timeline (visualização)",
      ];
    }

    const suggestions: string[] = [];

    if (snapshot.counts.memoriesTotal === 0) {
      suggestions.push("Criar sua primeira memória");
    } else {
      suggestions.push("Revisar sua última memória");
    }

    suggestions.push("Escolher seus capítulos iniciais");
    suggestions.push("Explorar a Timeline (visualização)");

    return suggestions;
  }, [snapshot]);

  function handleSuggestionClick(index: number) {
    if (!snapshot) return;

    if (index === 0) {
      // Revisar última memória → pega a mais recente
      const last = snapshot.recentMemories?.[0];
      if (last) navigate(`/memories/${last.memory_id}`);
      return;
    }

    if (index === 1) {
      navigate("/chapters");
      return;
    }

    if (index === 2) {
      navigate("/timeline");
      return;
    }
  }

  return (
    <div className="hdud-page space-y-4">
      <div className="hdud-card">
        <h1 className="hdud-title">Feed</h1>
        <p className="hdud-subtitle">
          Sua visão geral do HDUD. Aqui você verá o que mudou, o que está em
          progresso e sugestões de próximos passos.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border px-3 py-2 text-sm">
            <div className="font-semibold">Atenção</div>
            <div className="opacity-80">{error}</div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ComingSoonPanel
          title="Sua semana"
          subtitle="Resumo do seu ritmo: novas memórias, versões e marcos."
          hint={loading ? "Carregando" : snapshot ? "Atualizado" : "Em breve"}
        >
          {weekItems ? (
            <PlaceholderList items={weekItems} badgeLabel="real" />
          ) : (
            <PlaceholderList
              items={[
                "0 memórias criadas",
                "0 versões registradas",
                "0 rollbacks aplicados",
                "0 capítulos atualizados",
              ]}
              badgeLabel="placeholder"
            />
          )}
        </ComingSoonPanel>

        <ComingSoonPanel
          title="Memórias recentes"
          subtitle="As últimas memórias criadas/atualizadas aparecerão aqui."
          hint={loading ? "Carregando" : snapshot ? "Atualizado" : "Em breve"}
        >
          {recentItems ? (
            recentItems.length > 0 ? (
              <PlaceholderList items={recentItems} badgeLabel="real" />
            ) : (
              <PlaceholderList
                items={["Nenhuma memória encontrada ainda."]}
                badgeLabel="real"
              />
            )
          ) : (
            <PlaceholderList
              items={[
                "Ex.: 'Minha primeira lembrança…'",
                "Ex.: 'O dia em que eu decidi…'",
                "Ex.: 'Uma conversa que mudou tudo…'",
              ]}
              badgeLabel="placeholder"
            />
          )}
        </ComingSoonPanel>

        <ComingSoonPanel
          title="Em progresso"
          subtitle="Itens que estão no seu radar e precisam de continuidade."
          hint="Em breve"
        >
          <PlaceholderList
            items={[
              "Capítulo: Origem (planejado)",
              "Capítulo: Infância (planejado)",
              "Capítulo: Trabalho (planejado)",
            ]}
            badgeLabel="placeholder"
          />
        </ComingSoonPanel>

        <ComingSoonPanel
          title="Sugestões do produto"
          subtitle="Próximos passos guiados (onboarding e evolução)."
          hint={snapshot ? "Personalizado" : "Em breve"}
        >
          <PlaceholderList
            items={onboardingSuggestions}
            badgeLabel={snapshot ? "sugestão" : "placeholder"}
            onItemClick={handleSuggestionClick}
          />
        </ComingSoonPanel>
      </div>
    </div>
  );
}
