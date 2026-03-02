// C:\HDUD_DATA\hdud-web-app\src\components\Topbar.tsx
import React, { useEffect } from "react";

type Props = {
  onLogout?: () => void;
};

/**
 * DEPRECATED (LEGADO)
 * ------------------
 * O Topbar oficial é o do AppShell vNext (src/layouts/AppShell.tsx).
 * Este arquivo existe apenas para evitar retrabalho caso algum import antigo ainda exista.
 *
 * Se você estiver vendo este warning, procure e remova o import legado.
 */
export default function Topbar(_props: Props) {
  useEffect(() => {
    // DEV-only (evita poluir prod)
    if ((import.meta as any).env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        "[HDUD][LEGACY] components/Topbar.tsx foi renderizado. " +
          "O Topbar oficial é o do AppShell vNext (src/layouts/AppShell.tsx). " +
          "Remova o import/uso legado para eliminar duplicação."
      );
    }
  }, []);

  // ✅ No-op: evita header duplicado
  return null;
}