// C:\HDUD_DATA\hdud-web-app\src\pages\TimelinePage.tsx

import React from "react";
import ComingSoonPanel from "../components/ComingSoonPanel";

type TimelineStub = {
  when: string;
  title: string;
  kind: "Memória" | "Versão" | "Rollback";
  note: string;
};

const ITEMS: TimelineStub[] = [
  {
    when: "Hoje",
    title: "Primeira memória (exemplo)",
    kind: "Memória",
    note: "Entrada inicial de uma lembrança, ainda sem conteúdo real.",
  },
  {
    when: "Hoje",
    title: "Versão 1 (exemplo)",
    kind: "Versão",
    note: "O core registrará versões; aqui é apenas visualização placeholder.",
  },
  {
    when: "Esta semana",
    title: "Rollback (exemplo)",
    kind: "Rollback",
    note: "Rollback aparecerá como evento de timeline (visual).",
  },
];

function KindPill({ kind }: { kind: TimelineStub["kind"] }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs opacity-90">
      {kind}
    </span>
  );
}

export default function TimelinePage() {
  const filters = ["Tudo", "Memórias", "Versões", "Rollbacks"];

  return (
    <div className="hdud-page space-y-4">
      <div className="hdud-card">
        <h1 className="hdud-title">Timeline</h1>
        <p className="hdud-subtitle">
          Visualização temporal do que aconteceu na sua história: memórias,
          versões, diffs e rollbacks — começando como esqueleto, sem lógica.
        </p>
      </div>

      <ComingSoonPanel
        title="Filtros"
        subtitle="A navegação aqui é visual (sem lógica no MVP inicial)."
        hint="Em breve"
      >
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <span
              key={f}
              className="inline-flex items-center rounded-full border px-3 py-1 text-sm opacity-90"
            >
              {f}
            </span>
          ))}
        </div>
      </ComingSoonPanel>

      <ComingSoonPanel
        title="Eventos"
        subtitle="Os eventos serão agrupados por data e tipo."
        hint="Em breve"
      >
        <div className="space-y-3">
          {ITEMS.map((it, idx) => (
            <div key={`${it.title}-${idx}`} className="rounded-lg border px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs opacity-70">{it.when}</div>
                  <div className="font-medium leading-6">{it.title}</div>
                  <div className="text-sm opacity-80">{it.note}</div>
                </div>
                <div className="shrink-0">
                  <KindPill kind={it.kind} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-sm opacity-80">
          Observação: quando conectarmos dados reais, esta tela apenas
          “consumirá” o core (versões/diff/rollback), sem reimplementar lógica.
        </div>
      </ComingSoonPanel>
    </div>
  );
}
