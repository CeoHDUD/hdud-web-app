// C:\HDUD_DATA\hdud-web-app\src\features\timeline\components\TimelineStats.tsx

import React from "react";
import { TimelineThread } from "../types";

type Props = {
  threads: TimelineThread[];
};

export default function TimelineStats({ threads }: Props) {
  const total = threads.length;

  const avg =
    total > 0
      ? (threads.reduce((acc, t) => acc + t.score, 0) / total).toFixed(2)
      : "0";

  const peak =
    total > 0 ? Math.max(...threads.map((t) => t.score)) : 0;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <strong>Threads</strong>
        <div>{total}</div>
      </div>

      <div style={styles.card}>
        <strong>Média</strong>
        <div>{avg}</div>
      </div>

      <div style={styles.card}>
        <strong>Pico editorial</strong>
        <div>{peak}</div>
      </div>
    </div>
  );
}

const styles: any = {
  container: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 10,
  },
};