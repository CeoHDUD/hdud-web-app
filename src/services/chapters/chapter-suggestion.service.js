// C:\HDUD_DATA\hdud-api-node\src\services\chapters\chapter-suggestion.service.js

export function suggestChapterFromCluster(cluster) {
  if (!cluster || cluster.length === 0) return null;

  const texts = cluster.map((m) => m.content || "").join(" ");

  const keywords = extractKeywords(texts);

  return {
    suggested_title: buildTitle(keywords),
    description: buildDescription(cluster),
    confidence: Math.min(0.95, 0.6 + cluster.length * 0.05),
  };
}

function extractKeywords(text) {
  const stopwords = ["de", "a", "o", "e", "que", "do", "da"];
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.includes(w));

  const freq = {};

  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);
}

function buildTitle(keywords) {
  if (!keywords.length) return "Um capítulo da sua vida";

  return `Capítulo sobre ${keywords.join(", ")}`;
}

function buildDescription(cluster) {
  return `Este capítulo reúne ${cluster.length} memórias que parecem conectadas por contexto e significado.`;
}