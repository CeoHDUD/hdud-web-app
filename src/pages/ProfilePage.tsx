// C:\HDUD_DATA\hdud-web-app\src\pages\ProfilePage.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPut, ApiError } from "../lib/api";

type MeProfile = {
  author_id: number;
  email: string | null;
  name_public: string | null;
  bio_short: string | null;
  location: string | null;
  avatar_url: string | null;
};

function norm(v: string): string | null {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

function isProbablyHttpUrl(v: string): boolean {
  const s = (v ?? "").trim();
  if (!s) return true; // vazio é ok (null)
  return /^https?:\/\/.+/i.test(s);
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
  const [avatarUrl, setAvatarUrl] = useState("");

  // avatar checks (sem card/foto redundante aqui)
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
      location !== ini.location ||
      avatarUrl !== ini.avatarUrl
    );
  }, [namePublic, bioShort, location, avatarUrl]);

  const avatarUrlValid = useMemo(() => isProbablyHttpUrl(avatarUrl), [avatarUrl]);

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
    const u = (url ?? "").trim();

    if (!mountedRef.current) return;

    setAvatarHint(null);

    if (!u) {
      setAvatarCheck("idle");
      return;
    }

    if (!isProbablyHttpUrl(u)) {
      setAvatarCheck("fail");
      setAvatarHint("A URL precisa começar com http:// ou https://");
      return;
    }

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
        setAvatarHint("Não consegui carregar a imagem desse link.");
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

      // valida silenciosamente o avatar (sem mostrar foto aqui)
      setAvatarCheck("idle");
      setAvatarHint(null);
      if (av?.trim()) {
        // não bloquear o load; dispara async "best effort"
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
      // validação leve (MVP)
      if (!avatarUrlValid) {
        setError("O link do avatar precisa começar com http:// ou https:// (ou ficar vazio).");
        return;
      }

      const payload = {
        name_public: norm(namePublic),
        bio_short: norm(bioShort),
        location: norm(location),
        avatar_url: norm(avatarUrl),
      };

      await apiPut("/me/profile", payload);

      // Recarrega /me/profile para manter normalização/fallback exatos do backend
      const cancelled = { current: false };
      await load(cancelled);

      // força AppShell a recarregar mini-perfil (avatar topo)
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

  function onReset() {
    const ini = initialRef.current;
    if (!ini) return;

    setNamePublic(ini.namePublic);
    setBioShort(ini.bioShort);
    setLocation(ini.location);
    setAvatarUrl(ini.avatarUrl);

    setAvatarCheck("idle");
    setAvatarHint(null);
    if (ini.avatarUrl?.trim()) checkAvatar(ini.avatarUrl);

    setError(null);
    setStatus(null);
  }

  const displayName =
    (profile?.name_public ?? "").trim() || (namePublic ?? "").trim() || "Autor";

  const emailLine = loading ? "Carregando…" : profile?.email ? profile.email : "—";

  const canEdit = !loading && !!profile;

  const avatarBadge = useMemo(() => {
    if (!avatarUrl?.trim()) return null;
    if (!avatarUrlValid) return { text: "Link inválido", tone: "warn" as const };
    if (avatarCheck === "checking") return { text: "Verificando…", tone: "neutral" as const };
    if (avatarCheck === "ok") return { text: "Avatar OK", tone: "ok" as const };
    if (avatarCheck === "fail") return { text: "Falhou", tone: "warn" as const };
    return null;
  }, [avatarUrl, avatarUrlValid, avatarCheck]);

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

          {!error && status ? (
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
                  <label style={{ display: "grid", gap: 6 }}>
                    <div style={{ opacity: 0.9, fontSize: 13 }}>Avatar (URL da imagem)</div>
                    <input
                      className="hdud-input"
                      value={avatarUrl}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAvatarUrl(v);
                        setAvatarCheck("idle");
                        setAvatarHint(null);
                        // ✅ invalida checagens anteriores imediatamente
                        avatarCheckSeq.current += 1;
                      }}
                      onBlur={() => checkAvatar(avatarUrl)}
                      placeholder="https://… (link direto para uma imagem)"
                      maxLength={400}
                      disabled={!canEdit}
                    />

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        className="hdud-btn"
                        type="button"
                        disabled={!canEdit || saving || loading}
                        onClick={() => checkAvatar(avatarUrl)}
                        title="Validar se a imagem carrega"
                      >
                        Validar link
                      </button>

                      {avatarBadge ? (
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
                      ) : null}
                    </div>

                    {avatarHint ? (
                      <div style={{ opacity: 0.75, fontSize: 12 }}>{avatarHint}</div>
                    ) : (
                      <div style={{ opacity: 0.6, fontSize: 12 }}>
                        O avatar aparece no topo do app. Aqui você só define o link.
                      </div>
                    )}
                  </label>
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
