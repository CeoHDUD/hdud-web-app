// C:\HDUD_DATA\hdud-web-app\src\components\NarrativeSuggestionCard.tsx
import React, { useEffect, useState } from "react";

export default function NarrativeSuggestionCard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/narrative/clusters", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data || !data.suggestions?.length) return null;

  const first = data.suggestions[0];

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
      }}
    >
      <h3>✨ Capítulo sugerido</h3>

      <h4>{first.suggestion.suggested_title}</h4>

      <p>{first.suggestion.description}</p>

      <small>
        Confiança: {(first.suggestion.confidence * 100).toFixed(0)}%
      </small>

      <div style={{ marginTop: 12 }}>
        <button>Criar capítulo</button>
        <button style={{ marginLeft: 8 }}>Ignorar</button>
      </div>
    </div>
  );
}