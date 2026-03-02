// C:\HDUD_DATA\hdud-web-app\src\components\Sidebar.tsx
import React, { useEffect } from "react";

/**
 * DEPRECATED (LEGADO)
 * ------------------
 * A Sidebar oficial é a coluna de ícones dentro do AppShell vNext (src/layouts/AppShell.tsx).
 * Este arquivo existe apenas para compatibilidade temporária caso algum import antigo ainda exista.
 *
 * Se você estiver vendo este warning, procure e remova o import legado.
 */
export default function Sidebar() {
  useEffect(() => {
    // DEV-only (evita poluir prod)
    if ((import.meta as any).env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        "[HDUD][LEGACY] components/Sidebar.tsx foi renderizado. " +
          "A navegação oficial é a do AppShell vNext (src/layouts/AppShell.tsx). " +
          "Remova o import/uso legado para eliminar duplicação."
      );
    }
  }, []);

  // ✅ No-op: evita sidebar paralela ativa
  return null;
}