import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Props = { token: string };

type MemoryDetail = {
  id?: number | string;
  authorId?: number | string;
  title?: string;
  content?: string;
  createdAt?: string;
  versionNumber?: number;
  isDeleted?: boolean;
  meta?: { can_edit?: boolean; current_version?: number } | any;
  raw?: any;
};

type MemoryVersion = {
  memory_id: number;
  version_number: number;
  title?: string;
  content?: string;
  created_at?: string;
  created_by?: string;
};

type DiffRow = { t: "eq" | "add" | "del"; v: string };

export default function MemoryDetailPage({ token }: Props) {
  const { id } = useParams();
  const nav = useNavigate();

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [memory, setMemory] = useState<MemoryDetail | null>(null);

  const [loadingVersions, setLoadingVersions] = useState(false);
  const [errorVersions, setErrorVersions] = useState<string | null>(null);
  const [versions, setVersions] = useState<MemoryVersion[]>([]);

  // === EDIÇÃO (PUT) ===
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);
  const [successEdit, setSuccessEdit] = useState<string | null>(null);

  // === DIFF (Comparar versões) ===
  const [diffVA, setDiffVA] = useState<number | null>(null);
  const [diffVB, setDiffVB] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const memoryIdNum = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const badge: CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    background: "#fafafa",
    color: "#222",
  };

  const subtle: CSSProperties = { color: "#666", fontSize: 13 };

  const input: CSSProperties = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #d7dbe7",
    outline: "none",
    fontSize: 14,
  };

  const textarea: CSSProperties = {
    ...input,
    minHeight: 180,
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.45,
  };

  // ✅ Compacto: DD/MM/AAAA HH:MM (sem e-mail)
  function fmtDateTimeCompactPtBR(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
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
    return payload?.error || payload?.message || null;
  }

  async function loadDetail() {
    if (!memoryIdNum) return;
    setLoadingDetail(true);
    setErrorDetail(null);

    try {
      const res = await fetch(`/api/memories/${memoryIdNum}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const payload = await readJsonOrText(res);
        const msg = messageFromErrorPayload(payload);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const txt = await res.text();
        throw new Error(
          `Resposta não-JSON (${res.status}). Início: ${txt.slice(0, 80)}`
        );
      }

      const m = await res.json();

      setMemory({
        id: m.memory_id,
        authorId: m.author_id,
        title: m.title,
        content: m.content,
        createdAt: m.created_at,
        versionNumber: m.version_number,
        isDeleted: m.is_deleted,
        meta: m.meta,
        raw: m,
      });
    } catch (e: any) {
      console.error(e);
      setErrorDetail(e?.message ?? "Erro ao carregar memória.");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadVersions() {
    if (!memoryIdNum) return;
    setLoadingVersions(true);
    setErrorVersions(null);

    try {
      const res = await fetch(`/api/memories/${memoryIdNum}/versions`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const payload = await readJsonOrText(res);
        const msg = messageFromErrorPayload(payload);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const txt = await res.text();
        throw new Error(
          `Resposta não-JSON (${res.status}). Início: ${txt.slice(0, 80)}`
        );
      }

      const json = await res.json();
      const list: MemoryVersion[] = Array.isArray(json?.versions)
        ? json.versions
        : [];
      setVersions(list);

      // inicializa seletores de diff de forma segura
      const nums = list
        .map((x) => x.version_number)
        .filter((x) => Number.isFinite(x));
      const uniqSorted = Array.from(new Set(nums)).sort((a, b) => a - b);

      if (uniqSorted.length >= 2) {
        if (diffVA == null) setDiffVA(uniqSorted[uniqSorted.length - 2]);
        if (diffVB == null) setDiffVB(uniqSorted[uniqSorted.length - 1]);
      } else if (uniqSorted.length === 1) {
        if (diffVA == null) setDiffVA(uniqSorted[0]);
        if (diffVB == null) setDiffVB(uniqSorted[0]);
      }
    } catch (e: any) {
      console.error(e);
      setErrorVersions(e?.message ?? "Erro ao carregar versões.");
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }

  function startEdit() {
    if (!memory) return;
    setSuccessEdit(null);
    setErrorEdit(null);
    setDraftTitle(memory.title ?? "");
    setDraftContent(memory.content ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setErrorEdit(null);
    setSuccessEdit(null);
    setEditing(false);
    setDraftTitle("");
    setDraftContent("");
  }

  async function saveEdit() {
    if (!memoryIdNum) return;

    setSuccessEdit(null);
    setErrorEdit(null);

    const contentTrim = (draftContent ?? "").trim();
    if (!contentTrim) {
      setErrorEdit("Conteúdo é obrigatório.");
      return;
    }

    const titleTrim = (draftTitle ?? "").trim();
    const payload: any = { content: contentTrim };
    payload.title = titleTrim ? titleTrim : null;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/memories/${memoryIdNum}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!res.ok) {
        const payloadErr = await readJsonOrText(res);
        const msg = messageFromErrorPayload(payloadErr);

        const txt = typeof payloadErr === "string" ? payloadErr : "";
        const hint =
          res.status === 404 && txt.includes("Not Found")
            ? "Not Found — verifique o proxy do Vite para /api (deve apontar para http://hdud-api:4000)."
            : null;

        throw new Error(msg || hint || `HTTP ${res.status}`);
      }

      await loadDetail();
      await loadVersions();

      setEditing(false);
      setSuccessEdit("Alterações salvas — nova versão registrada.");
    } catch (e: any) {
      console.error(e);
      setErrorEdit(e?.message ?? "Erro ao salvar alterações.");
    } finally {
      setSavingEdit(false);
    }
  }

  // === ROLLBACK (restaurar versão criando nova) ===
  async function restoreVersion(v: MemoryVersion) {
    if (!memoryIdNum) return;
    if (!canEdit) return;

    const ok = window.confirm(
      `Restaurar a versão v${v.version_number}?\n\n` +
        `Isso criará uma NOVA versão baseada nessa versão.\n` +
        `O histórico não será apagado.`
    );

    if (!ok) return;

    setErrorEdit(null);
    setSuccessEdit(null);
    setSavingEdit(true);

    try {
      const payload = {
        title: (v.title ?? "").trim() || null,
        content: (v.content ?? "").trim(),
      };

      if (!payload.content) {
        throw new Error("Não é possível restaurar uma versão sem conteúdo.");
      }

      const res = await fetch(`/api/memories/${memoryIdNum}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!res.ok) {
        const payloadErr = await readJsonOrText(res);
        const msg = messageFromErrorPayload(payloadErr);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      await loadDetail();
      await loadVersions();

      setSuccessEdit(
        `Rollback criado: nova versão baseada na v${v.version_number}.`
      );
    } catch (e: any) {
      console.error(e);
      setErrorEdit(e?.message ?? "Erro ao restaurar versão.");
    } finally {
      setSavingEdit(false);
    }
  }

  // === DIFF helpers (só leitura) ===
  function getVersionContent(vn: number | null): string {
    if (vn == null) return "";
    const v = versions.find((x) => x.version_number === vn);
    return (v?.content ?? "") as string;
  }

  function diffLines(a = "", b = ""): DiffRow[] {
    const aL = String(a ?? "").split("\n");
    const bL = String(b ?? "").split("\n");

    const out: DiffRow[] = [];
    const max = Math.max(aL.length, bL.length);

    for (let i = 0; i < max; i++) {
      const left = aL[i] ?? "";
      const right = bL[i] ?? "";

      if (left === right) {
        if (left.trim() !== "") out.push({ t: "eq", v: left });
        continue;
      }

      if (left.trim() !== "") out.push({ t: "del", v: left });
      if (right.trim() !== "") out.push({ t: "add", v: right });
    }

    return out;
  }

  const canCompare = versions.length >= 1 && diffVA != null && diffVB != null;
  const diffRows: DiffRow[] =
    showDiff && canCompare
      ? diffLines(getVersionContent(diffVA), getVersionContent(diffVB))
      : [];

  useEffect(() => {
    loadDetail();
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const currentVersion =
    (memory?.raw?.meta?.current_version ??
      memory?.raw?.meta?.currentVersion ??
      memory?.versionNumber ??
      1) as number;

  const canEdit =
    memory?.raw?.meta?.can_edit ?? memory?.raw?.meta?.canEdit ?? false;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <button onClick={() => nav("/memories")} style={{ marginBottom: 16 }}>
        ← Voltar
      </button>

      {(loadingDetail || loadingVersions) && (
        <p style={{ opacity: 0.75 }}>Carregando...</p>
      )}

      {errorDetail && <p style={{ color: "crimson" }}>{errorDetail}</p>}

      {!errorDetail && !loadingDetail && !memory && (
        <p style={{ opacity: 0.75 }}>Memória não encontrada.</p>
      )}

      {memory && (
        <>
          {/* Cabeçalho */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 260 }}>
              <h1 style={{ marginBottom: 6, fontSize: 28, lineHeight: 1.15 }}>
                {memory.title || "(sem título)"}
              </h1>
              <div style={subtle}>
                Criada em{" "}
                <strong>{fmtDateTimeCompactPtBR(memory.createdAt)}</strong>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <span style={badge}>v{currentVersion}</span>
              {canEdit && <span style={badge}>Editável</span>}
              {memory.authorId != null && (
                <span style={badge}>Autor {String(memory.authorId)}</span>
              )}
              {memory.isDeleted && (
                <span
                  style={{
                    ...badge,
                    borderColor: "#f3bcbc",
                    background: "#fff5f5",
                  }}
                >
                  Apagada
                </span>
              )}
            </div>
          </div>

          {/* Ações */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 14,
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={loadDetail}
                disabled={loadingDetail}
                style={{ fontSize: 12 }}
              >
                {loadingDetail ? "Atualizando..." : "Recarregar detalhe"}
              </button>

              <button
                onClick={loadVersions}
                disabled={loadingVersions}
                style={{ fontSize: 12 }}
              >
                {loadingVersions ? "Atualizando..." : "Recarregar versões"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canEdit && !editing && (
                <button
                  onClick={startEdit}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #0f172a",
                    background: "#0f172a",
                    color: "white",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Editar
                </button>
              )}

              {canEdit && editing && (
                <>
                  <button
                    onClick={cancelEdit}
                    disabled={savingEdit}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #d7dbe7",
                      background: "white",
                      fontWeight: 800,
                      cursor: savingEdit ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #0f172a",
                      background: "#0f172a",
                      color: "white",
                      fontWeight: 900,
                      cursor: savingEdit ? "not-allowed" : "pointer",
                    }}
                  >
                    {savingEdit ? "Salvando..." : "Salvar alterações"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Feedback edição */}
          {(errorEdit || successEdit) && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${errorEdit ? "#f3bcbc" : "#cce6d0"}`,
                background: errorEdit ? "#fff5f5" : "#f3fff5",
                color: errorEdit ? "#a31212" : "#145a20",
                fontWeight: 700,
              }}
            >
              {errorEdit ?? successEdit}
            </div>
          )}

          {/* Conteúdo */}
          <div
            style={{
              border: "1px solid #e6e6e6",
              padding: 16,
              borderRadius: 12,
              marginTop: 18,
              background: "#fff",
            }}
          >
            <div style={{ opacity: 0.65, fontSize: 12, marginBottom: 8 }}>
              {editing
                ? "Edição (salvar cria nova versão)"
                : "Conteúdo (estado atual)"}
            </div>

            {!editing ? (
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {memory.content || "(vazio)"}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      opacity: 0.75,
                      marginBottom: 6,
                    }}
                  >
                    Título
                  </div>
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="(opcional)"
                    style={input}
                    disabled={savingEdit}
                  />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      opacity: 0.75,
                      marginBottom: 6,
                    }}
                  >
                    Conteúdo *
                  </div>
                  <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder="Escreva aqui..."
                    style={textarea}
                    disabled={savingEdit}
                  />
                </div>

                <div style={{ ...subtle }}>
                  Ao salvar, o HDUD registra uma <strong>nova versão</strong>{" "}
                  (timeline) — não sobrescreve versões anteriores.
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>Linha do Tempo (Versões)</h3>
              <button
                onClick={loadVersions}
                disabled={loadingVersions}
                style={{ fontSize: 12 }}
              >
                {loadingVersions ? "Atualizando..." : "Recarregar versões"}
              </button>
            </div>

            <p style={{ marginTop: 6, ...subtle }}>
              Versão atual: <strong>v{currentVersion}</strong>
              {" • "}
              {versions.length > 0
                ? `${versions.length} versão(ões) registradas`
                : "nenhuma versão registrada ainda"}
            </p>

            {errorVersions && <p style={{ color: "crimson" }}>{errorVersions}</p>}

            {!loadingVersions && versions.length === 0 ? (
              <div
                style={{
                  marginTop: 12,
                  border: "1px dashed #d8d8d8",
                  borderRadius: 12,
                  padding: 14,
                  background: "#fafafa",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Nenhuma versão encontrada
                </div>
                <div style={subtle}>
                  Edite e salve esta memória para gerar a primeira versão no
                  histórico.
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {versions.map((v) => (
                  <div
                    key={`${v.memory_id}-${v.version_number}`}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 12,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={badge}>v{v.version_number}</span>
                        <span style={{ fontWeight: 600 }}>
                          {v.title || "(sem título)"}
                        </span>
                        {v.version_number === currentVersion && (
                          <span
                            style={{
                              ...badge,
                              borderColor: "#cce6d0",
                              background: "#f3fff5",
                            }}
                          >
                            Atual
                          </span>
                        )}
                      </div>

                      {/* ✅ compactado */}
                      <div style={subtle}>
                        {fmtDateTimeCompactPtBR(v.created_at)}
                      </div>
                    </div>

                    <div style={{ marginTop: 8, ...subtle }}>
                      <div
                        style={{
                          opacity: 0.75,
                          fontSize: 12,
                          marginBottom: 6,
                        }}
                      >
                        Snapshot
                      </div>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.45,
                          color: "#222",
                        }}
                      >
                        {v.content || "(vazio)"}
                      </div>
                    </div>

                    {canEdit && v.version_number !== currentVersion && (
                      <button
                        onClick={() => restoreVersion(v)}
                        disabled={savingEdit}
                        style={{
                          marginTop: 10,
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid #0f172a",
                          background: "white",
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: savingEdit ? "not-allowed" : "pointer",
                        }}
                      >
                        🔁 Restaurar esta versão
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* === Comparação de versões (Diff) === */}
            <div
              style={{
                marginTop: 18,
                borderTop: "1px solid #eee",
                paddingTop: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>
                    Comparar versões
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Selecione duas versões e veja o que foi adicionado/removido
                    (diff por linhas).
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <select
                    value={diffVA ?? ""}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDiffVA(Number.isFinite(v) ? v : null);
                      setShowDiff(false);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #d7dbe7",
                    }}
                  >
                    <option value="">Versão A</option>
                    {versions
                      .map((x) => x.version_number)
                      .filter((x, idx, arr) => arr.indexOf(x) === idx)
                      .sort((a, b) => a - b)
                      .map((vn) => (
                        <option key={`a-${vn}`} value={vn}>
                          v{vn}
                        </option>
                      ))}
                  </select>

                  <select
                    value={diffVB ?? ""}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDiffVB(Number.isFinite(v) ? v : null);
                      setShowDiff(false);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #d7dbe7",
                    }}
                  >
                    <option value="">Versão B</option>
                    {versions
                      .map((x) => x.version_number)
                      .filter((x, idx, arr) => arr.indexOf(x) === idx)
                      .sort((a, b) => a - b)
                      .map((vn) => (
                        <option key={`b-${vn}`} value={vn}>
                          v{vn}
                        </option>
                      ))}
                  </select>

                  <button
                    onClick={() => setShowDiff(true)}
                    disabled={!canCompare}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1px solid #0f172a",
                      background: canCompare ? "#0f172a" : "#9aa3b2",
                      color: "white",
                      fontWeight: 900,
                      cursor: canCompare ? "pointer" : "not-allowed",
                    }}
                  >
                    Comparar
                  </button>

                  {showDiff && (
                    <button
                      onClick={() => setShowDiff(false)}
                      style={{
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1px solid #d7dbe7",
                        background: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Fechar
                    </button>
                  )}
                </div>
              </div>

              {showDiff && (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span style={badge}>A: v{diffVA}</span>
                    <span style={badge}>B: v{diffVB}</span>
                    <span style={{ ...subtle }}>
                      🟢 adições • 🔴 remoções • linhas iguais são omitidas para
                      ficar legível
                    </span>
                  </div>

                  {diffRows.length === 0 ? (
                    <div style={subtle}>
                      Nenhuma diferença detectada (ou conteúdo vazio nas versões
                      selecionadas).
                    </div>
                  ) : (
                    <div
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                      }}
                    >
                      {diffRows.map((row, idx) => {
                        const isAdd = row.t === "add";
                        const isDel = row.t === "del";
                        const color = isAdd
                          ? "#145a20"
                          : isDel
                          ? "#a31212"
                          : "#222";
                        const bg = isAdd
                          ? "#f3fff5"
                          : isDel
                          ? "#fff5f5"
                          : "transparent";
                        const prefix = isAdd ? "+ " : isDel ? "- " : "  ";

                        return (
                          <div
                            key={idx}
                            style={{
                              color,
                              background: bg,
                              padding: "2px 6px",
                              borderRadius: 8,
                              marginBottom: 4,
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.45,
                            }}
                          >
                            {prefix}
                            {row.v}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* === /Diff === */}
          </div>
        </>
      )}
    </div>
  );
}
