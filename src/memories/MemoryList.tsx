// C:\HDUD_DATA\hdud-web-app\src\memories\MemoryList.tsx
import React from "react";
import { Link } from "react-router-dom";

type Memory = {
  id: string;
  title?: string;
  created_at: string;
  version?: number;
};

type Props = {
  memories: Memory[];
};

export default function MemoryList({ memories }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {memories.map((m) => (
        <Link
          key={m.id}
          to={`/memories/${m.id}`}
          style={{ textDecoration: "none" }}
        >
          <div
            style={{
              background: "linear-gradient(180deg,#0B1220,#0A1020)",
              border: "1px solid rgba(148,163,184,0.12)",
              borderRadius: 14,
              padding: "14px 16px",
              boxShadow: "0 6px 22px rgba(0,0,0,0.25)",
              transition: "transform .12s ease, border-color .12s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <strong style={{ color: "#E5E7EB", fontSize: 14 }}>
                {m.title || "Sem título"}
              </strong>

              <span
                style={{
                  fontSize: 11,
                  color: "#94A3B8",
                  whiteSpace: "nowrap",
                }}
              >
                {new Date(m.created_at).toLocaleString("pt-BR")}
              </span>
            </div>

            <div style={{ fontSize: 12, color: "#94A3B8" }}>
              {m.version ? `v${m.version}` : "snapshot"}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
