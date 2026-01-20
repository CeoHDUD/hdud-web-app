// C:\HDUD_DATA\hdud-web-app\src\layouts\AppShell.tsx

import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

type Props = {
  onLogout: () => void;
};

export default function AppShell({ onLogout }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "var(--sidebar-w) 1fr",
        height: "100vh",
      }}
    >
      <Sidebar />

      <div style={{ display: "grid", gridTemplateRows: "var(--topbar-h) 1fr" }}>
        <Topbar onLogout={onLogout} />

        <main style={{ overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
