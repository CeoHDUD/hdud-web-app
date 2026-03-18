// C:\HDUD_DATA\hdud-web-app\src\features\timeline\components\TimelineThreadCard.tsx

import React from "react";
import { TimelineThread } from "../types";
import { formatDate } from "../utils";

type Props = {
  thread: TimelineThread;
};

export default function TimelineThreadCard({ thread }: Props) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <strong>{thread.lead.title}</strong>
        <span style={styles.kind}>{thread.kind}</span>
      </div>

      <div style={styles.meta}>
        <span>{thread.count} eventos</span>
        <span>{formatDate(thread.latestAt)}</span>
      </div>

      <div style={styles.score}>
        Score: {thread.score.toFixed(2)}
      </div>
    </div>
  );
}

const styles: any = {
  card: {
    padding: 14,
    border: "1px solid #ddd",
    borderRadius: 12,
    marginBottom: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  kind: {
    fontSize: 12,
    opacity: 0.6,
  },
  meta: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    opacity: 0.7,
  },
  score: {
    marginTop: 8,
    fontWeight: "bold",
  },
};