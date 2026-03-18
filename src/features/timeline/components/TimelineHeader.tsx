// C:\HDUD_DATA\hdud-web-app\src\features\timeline\components\TimelineHeader.tsx

import React from "react";

type Props = {
  onRefresh: () => void;
};

export default function TimelineHeader({ onRefresh }: Props) {
  return (
    <div style={styles.container}>
      <div>
        <h1 style={styles.title}>Timeline Editorial</h1>
        <p style={styles.subtitle}>
          A história ganha forma em uma linha do tempo viva — com relevância editorial,
          contexto narrativo e evolução das memórias ao longo dos capítulos.
        </p>
      </div>

      <button style={styles.button} onClick={onRefresh}>
        Atualizar
      </button>
    </div>
  );
}

const styles: any = {
  container: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 28,
  },
  subtitle: {
    margin: "6px 0 0 0",
    opacity: 0.7,
  },
  button: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #ccc",
    cursor: "pointer",
    background: "#fff",
  },
};