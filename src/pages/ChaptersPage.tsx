// C:\HDUD_DATA\hdud-web-app\src\pages\ChaptersPage.tsx

import React from "react";
import ComingSoonPanel from "../components/ComingSoonPanel";

type ChapterStub = {
  title: string;
  note: string;
  status: "Planejado" | "Em breve";
};

const CHAPTERS: ChapterStub[] = [
  { title: "Origem", note: "Raízes, família, contexto e começo.", status: "Planejado" },
  { title: "Infância", note: "Primeiras memórias, lugares, pessoas.", status: "Planejado" },
  { title: "Adolescência", note: "Transições, identidade, escolhas.", status: "Planejado" },
  { title: "Trabalho", note: "Carreira, conquistas, aprendizados.", status: "Planejado" },
  { title: "Família", note: "Vínculos, afetos, legado.", status: "Planejado" },
  { title: "Marcos", note: "Eventos que mudaram sua trajetória.", status: "Em breve" },
];

function StatusPill({ status }: { status: ChapterStub["status"] }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs opacity-90">
      {status}
    </span>
  );
}

export default function ChaptersPage() {
  return (
    <div className="hdud-page space-y-4">
      <div className="hdud-card">
        <h1 className="hdud-title">Capítulos</h1>
        <p className="hdud-subtitle">
          Estrutura narrativa do seu livro de vida. Aqui você organiza o “mapa”
          da sua história — sem se preocupar com conteúdo agora.
        </p>
      </div>

      <ComingSoonPanel
        title="Estrutura inicial"
        subtitle="Capítulos sugeridos para iniciar seu onboarding (somente estrutura)."
        hint="Em breve"
      >
        <div className="space-y-2">
          {CHAPTERS.map((c) => (
            <div
              key={c.title}
              className="flex items-start justify-between gap-3 rounded-lg border px-3 py-3"
            >
              <div className="min-w-0">
                <div className="font-medium leading-6">{c.title}</div>
                <div className="text-sm opacity-80">{c.note}</div>
              </div>

              <div className="shrink-0">
                <StatusPill status={c.status} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-sm opacity-80">
          Observação: no MVP, esta tela começa com stubs e evolui para
          “capítulos reais” com vínculo às memórias (sem mexer no core).
        </div>
      </ComingSoonPanel>

      <ComingSoonPanel
        title="Coleções"
        subtitle="Coleções são agrupamentos opcionais (ex.: 'Carreira', 'Viagens', 'Fé')."
        hint="Em breve"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {["Carreira", "Família", "Viagens", "Aprendizados"].map((x) => (
            <div key={x} className="rounded-lg border px-3 py-3">
              <div className="font-medium">{x}</div>
              <div className="text-sm opacity-80">Placeholder de coleção</div>
            </div>
          ))}
        </div>
      </ComingSoonPanel>
    </div>
  );
}
