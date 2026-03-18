// C:\HDUD_DATA\hdud-api-node\src\services\narrative\narrative-cluster.service.js

export function buildSimpleNarrativeClusters(memories) {
  if (!Array.isArray(memories)) return [];

  // Estratégia MVP:
  // Agrupar por proximidade de data + palavras-chave simples

  const clusters = [];
  const used = new Set();

  for (let i = 0; i < memories.length; i++) {
    if (used.has(memories[i].memory_id)) continue;

    const base = memories[i];
    const cluster = [base];
    used.add(base.memory_id);

    for (let j = i + 1; j < memories.length; j++) {
      if (used.has(memories[j].memory_id)) continue;

      const candidate = memories[j];

      const sameYear =
        base.memory_date &&
        candidate.memory_date &&
        new Date(base.memory_date).getFullYear() ===
          new Date(candidate.memory_date).getFullYear();

      const textSimilarity =
        (base.content || "")
          .toLowerCase()
          .split(" ")
          .some((w) =>
            (candidate.content || "").toLowerCase().includes(w)
          );

      if (sameYear || textSimilarity) {
        cluster.push(candidate);
        used.add(candidate.memory_id);
      }
    }

    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  }

  return clusters;
}