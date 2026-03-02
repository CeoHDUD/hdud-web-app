// C:\HDUD_DATA\hdud-web-app\src\pages\ProfilePage.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPut, ApiError } from "../lib/api";

type MeProfile = {
  author_id: number;
  email: string | null;
  name_public: string | null;
  bio_short: string | null;
  location: string | null;
  avatar_url: string | null; // vindo do backend (somente leitura aqui)
};

function norm(v: string): string | null {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

/**
 * ✅ Resolve URL de avatar de forma CANÔNICA:
 * - Se vier absoluta (http/https): mantém
 * - Se vier "/cdn/...": aponta SEMPRE para API_BASE_URL (4000), nunca para 5173
 * - Se vier outros "/...":
 *    - se existir VITE_API_BASE_URL, também prefixa com API (DEV-safe)
 *    - senão usa origin atual (prod/proxy)
 */
function toAbsoluteCdnUrl(v: string): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\/.+/i.test(s)) return s;

  const API_BASE_URL =
    (import.meta as any).env?.VITE_API_BASE_URL || "";

  if (s.startsWith("/cdn/")) {
    const base = API_BASE_URL || "http://127.0.0.1:4000";
    return `${base}${s}`;
  }

  if (s.startsWith("/")) {
    // DEV: preferir backend, se informado
    if (API_BASE_URL && API_BASE_URL.trim()) return `${API_BASE_URL}${s}`;
    return `${window.location.origin}${s}`;
  }

  return s;
}

type AvatarCheckState = "idle" | "checking" | "ok" | "fail";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [profile, setProfile] = useState<MeProfile | null>(null);

  // form state (editável)
  const [namePublic, setNamePublic] = useState("");
  const [bioShort, setBioShort] = useState("");
  const [location, setLocation] = useState("");

  // avatar (somente leitura / gerenciado por upload)
  const [avatarUrl, setAvatarUrl] = useState("");

  // upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // avatar checks
  const [avatarCheck, setAvatarCheck] = useState<AvatarCheckState>("idle");
  const [avatarHint, setAvatarHint] = useState<string | null>(null);

  // snapshot inicial para dirty
  const initialRef = useRef<{
    namePublic: string;
    bioShort: string;
    location: string;
    avatarUrl: string;
  } | null>(null);

  // ✅ evita setState após unmount + ignora checagens antigas
  const mountedRef = useRef(true);
  const avatarCheckSeq = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const dirty = useMemo(() => {
    const ini = initialRef.current;
    if (!ini) return false;
    return (
      namePublic !== ini.namePublic ||
      bioShort !== ini.bioShort ||
      location !== ini.location
      // avatarUrl NÃO entra em dirty (é gerenciado pelo upload)
    );
  }, [namePublic, bioShort, location]);

  // ✅ Dirty Guard (refresh/fechar aba)
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ✅ Dirty Guard (app-level): informa AppShell/App.tsx
  // ✅ Cleanup: ao sair da página, garante que não fica “dirty preso”
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("hdud:dirty", {
        detail: {
          dirty,
          source: "profile",
          message: "Você tem alterações não salvas no Perfil. Deseja sair sem salvar?",
        },
      })
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("hdud:dirty", {
          detail: { dirty: false, source: "profile" },
        })
      );
    };
  }, [dirty]);

  async function checkAvatar(url: string) {
    const seq = ++avatarCheckSeq.current;
    const raw = (url ?? "").trim();

    if (!mountedRef.current) return;

    setAvatarHint(null);

    if (!raw) {
      setAvatarCheck("idle");
      return;
    }

    // ✅ fix: /cdn/... aponta para API_BASE
    const u = toAbsoluteCdnUrl(raw);

    setAvatarCheck("checking");

    await new Promise<void>((resolve) => {
      const img = new Image();

      const t = window.setTimeout(() => {
        if (!mountedRef.current) return resolve();
        if (seq !== avatarCheckSeq.current) return resolve();

        setAvatarCheck("fail");
        setAvatarHint("Timeout ao carregar a imagem (link lento ou indisponível).");
        resolve();
      }, 6000);

      const cleanup = () => {
        window.clearTimeout(t);
        img.onload = null;
        img.onerror = null;
        resolve();
      };

      img.onload = () => {
        if (!mountedRef.current) return cleanup();
        if (seq !== avatarCheckSeq.current) return cleanup();

        setAvatarCheck("ok");
        cleanup();
      };

      img.onerror = () => {
        if (!mountedRef.current) return cleanup();
        if (seq !== avatarCheckSeq.current) return cleanup();

        setAvatarCheck("fail");
        setAvatarHint("Não consegui carregar o avatar (talvez ainda não exista).");
        cleanup();
      };

      img.src = u;
    });
  }

  async function load(cancelled: { current: boolean }) {
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const me = await apiGet<MeProfile>("/me/profile");
      if (cancelled.current) return;

      setProfile(me);

      const np = me.name_public ?? "";
      const bs = me.bio_short ?? "";
      const lc = me.location ?? "";
      const av = me.avatar_url ?? "";

      setNamePublic(np);
      setBioShort(bs);
      setLocation(lc);
      setAvatarUrl(av);

      initialRef.current = {
        namePublic: np,
        bioShort: bs,
        location: lc,
        avatarUrl: av,
      };

      // valida silenciosamente o avatar
      setAvatarCheck("idle");
      setAvatarHint(null);
      if (av?.trim()) {
        checkAvatar(av);
      }
    } catch (e: any) {
      if (cancelled.current) return;

      if (e instanceof ApiError) {
        setError(e.message || `Erro HTTP ${e.status}`);
      } else {
        setError("Falha ao carregar perfil.");
      }
    } finally {
      if (cancelled.current) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    const cancelled = { current: false };
    load(cancelled);
    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave() {
    if (!profile) return;

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const payload = {
        name_public: norm(namePublic),
        bio_short: norm(bioShort),
        location: norm(location),
        // ✅ avatar_url removido: agora é gerenciado via upload/backend
      };

      await apiPut("/me/profile", payload);

      const cancelled = { current: false };
      await load(cancelled);

      window.dispatchEvent(new CustomEvent("hdud:profile-updated"));

      setStatus("Alterações salvas ✅");
      setTimeout(() => setStatus(null), 1800);
    } catch (e: any) {
      if (e instanceof ApiError) {
        setError(e.message || `Erro HTTP ${e.status}`);
      } else {
        setError("Falha ao salvar perfil.");
      }
    } finally {
      setSaving(false);
    }
  }

  // ✅ Token compat (igual ao padrão do app)
  function getAnyToken(): string | null {
    return (
      localStorage.getItem("HDUD_TOKEN") ||
      localStorage.getItem("hdud_access_token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      null
    );
  }

  async function onUploadAvatar() {
    setUploadError(null);
    setStatus(null);

    if (!selectedFile) {
      setUploadError("Selecione um arquivo primeiro.");
      return;
    }

    const token = getAnyToken();
    if (!token) {
      setUploadError("Não autenticado (token ausente). Faça login novamente.");
      return;
    }

    const API_BASE =
      (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:4000";

    try {
      setUploading(true);

      const form = new FormData();
      form.append("file", selectedFile);

      const res = await fetch(`${API_BASE}/me/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const newUrl = (data?.avatar_url && String(data.avatar_url).trim()) || "";
      if (!newUrl) {
        throw new Error("Upload OK, mas avatar_url não retornou.");
      }

      // Atualiza UI local imediatamente
      setAvatarUrl(newUrl);
      setAvatarCheck("idle");
      setAvatarHint(null);
      checkAvatar(newUrl);

      window.dispatchEvent(new CustomEvent("hdud:profile-updated"));

      // Recarrega /me/profile para manter consistência do backend
      const cancelled = { current: false };
      await load(cancelled);

      setStatus("Avatar enviado ✅");
      setTimeout(() => setStatus(null), 1800);

      // ✅ UX: limpa seleção do arquivo após sucesso
      setSelectedFile(null);
    } catch (e: any) {
      setUploadError(e?.message || "Falha no upload do avatar.");
    } finally {
      setUploading(false);
    }
  }

  function onReset() {
    const ini = initialRef.current;
    if (!ini) return;

    setNamePublic(ini.namePublic);
    setBioShort(ini.bioShort);
    setLocation(ini.location);

    setError(null);
    setStatus(null);
    setUploadError(null);
    setSelectedFile(null);
  }

  const displayName =
    (profile?.name_public ?? "").trim() || (namePublic ?? "").trim() || "Autor";

  const emailLine = loading ? "Carregando…" : profile?.email ? profile.email : "—";

  const canEdit = !loading && !!profile;

  const avatarBadge = useMemo(() => {
    if (!avatarUrl?.trim()) return { text: "Sem avatar", tone: "neutral" as const };
    if (avatarCheck === "checking") return { text: "Verificando…", tone: "neutral" as const };
    if (avatarCheck === "ok") return { text: "Avatar OK", tone: "ok" as const };
    if (avatarCheck === "fail") return { text: "Falhou", tone: "warn" as const };
    return { text: "—", tone: "neutral" as const };
  }, [avatarUrl, avatarCheck]);

  function badgeStyle(tone: "neutral" | "ok" | "warn") {
    if (tone === "ok") {
      return {
        border: "1px solid rgba(0,255,0,0.18)",
        background: "rgba(0,255,0,0.06)",
      };
    }
    if (tone === "warn") {
      return {
        border: "1px solid rgba(255,165,0,0.25)",
        background: "rgba(255,165,0,0.08)",
      };
    }
    return {
      border: "1px solid var(--hdud-border)",
      background: "rgba(255,255,255,0.03)",
    };
  }

  const avatarAbsolute = avatarUrl?.trim() ? toAbsoluteCdnUrl(avatarUrl) : "";

  return (
    <div className="hdud-page">
      <div className="hdud-card">
        {/* Header: identidade sem avatar (avatar é no topo/AppShell) */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 className="hdud-title" style={{ marginBottom: 4 }}>
              {displayName}
            </h1>
            <div className="hdud-subtitle" style={{ margin: 0 }}>
              {emailLine}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="hdud-btn"
              onClick={onReset}
              disabled={!dirty || saving || loading}
              title="Desfazer alterações não salvas"
            >
              Desfazer
            </button>
            <button
              className="hdud-btn hdud-btn-primary"
              onClick={onSave}
              disabled={saving || loading || !dirty}
              title="Salvar perfil"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          {error ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,0,0,0.25)",
                background: "rgba(255,0,0,0.08)",
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          ) : null}

          {uploadError ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,0,0,0.25)",
                background: "rgba(255,0,0,0.08)",
                marginBottom: 12,
              }}
            >
              {uploadError}
            </div>
          ) : null}

          {!error && !uploadError && status ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(0,255,0,0.18)",
                background: "rgba(0,255,0,0.06)",
                marginBottom: 12,
              }}
            >
              {status}
            </div>
          ) : null}

          {loading ? (
            <p className="hdud-subtitle">Carregando dados do autor…</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ opacity: 0.9, fontSize: 13 }}>Nome público</div>
                <input
                  className="hdud-input"
                  value={namePublic}
                  onChange={(e) => setNamePublic(e.target.value)}
                  placeholder="Ex.: Alexandre Neves"
                  maxLength={120}
                  disabled={!canEdit}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ opacity: 0.9, fontSize: 13 }}>Bio curta</div>
                <textarea
                  className="hdud-textarea"
                  value={bioShort}
                  onChange={(e) => setBioShort(e.target.value)}
                  placeholder="Uma frase que descreve você como autor."
                  maxLength={280}
                  rows={4}
                  disabled={!canEdit}
                />
                <div style={{ opacity: 0.6, fontSize: 12 }}>
                  {(bioShort?.length ?? 0)}/280
                </div>
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ opacity: 0.9, fontSize: 13 }}>Localização (opcional)</div>
                  <input
                    className="hdud-input"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex.: Rio de Janeiro, BR"
                    maxLength={120}
                    disabled={!canEdit}
                  />
                </label>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ opacity: 0.9, fontSize: 13 }}>Avatar</div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={!canEdit || uploading || saving || loading}
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setSelectedFile(f);
                          setUploadError(null);
                          setStatus(null);
                        }}
                      />

                      <button
                        className="hdud-btn hdud-btn-primary"
                        type="button"
                        onClick={onUploadAvatar}
                        disabled={!canEdit || uploading || !selectedFile}
                        title="Enviar avatar para o servidor"
                      >
                        {uploading ? "Enviando…" : "Enviar"}
                      </button>

                      <button
                        className="hdud-btn"
                        type="button"
                        disabled={!canEdit || saving || loading}
                        onClick={() => checkAvatar(avatarUrl)}
                        title="Validar se o avatar carrega"
                      >
                        Validar
                      </button>

                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          ...badgeStyle(avatarBadge.tone),
                        }}
                      >
                        {avatarBadge.text}
                      </div>
                    </div>

                    {avatarHint ? (
                      <div style={{ opacity: 0.75, fontSize: 12 }}>{avatarHint}</div>
                    ) : (
                      <div style={{ opacity: 0.6, fontSize: 12 }}>
                        O avatar é gerenciado pelo backend. URL canônica:{" "}
                        <b>/cdn/avatars/&lt;authorId&gt;/avatar</b> (sem extensão).
                      </div>
                    )}

                    {/* ✅ Sem input editável de URL (evita retrabalho e bug de extensão) */}
                    {avatarUrl?.trim() ? (
                      <div style={{ opacity: 0.6, fontSize: 12 }}>
                        Atual: <code>{avatarAbsolute}</code>
                      </div>
                    ) : (
                      <div style={{ opacity: 0.6, fontSize: 12 }}>Nenhum avatar enviado ainda.</div>
                    )}
                  </div>
                </div>
              </div>

              {dirty ? (
                <div style={{ opacity: 0.75, fontSize: 12 }}>Você tem alterações não salvas.</div>
              ) : (
                <div style={{ opacity: 0.6, fontSize: 12 }}>Tudo salvo.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
