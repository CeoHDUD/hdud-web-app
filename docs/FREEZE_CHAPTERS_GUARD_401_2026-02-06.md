# FREEZE — ChaptersPage Guard + 401 Redirect
Data: 2026-02-06

## Escopo congelado
- ChaptersPage.tsx:
  - Dirty Guard (confirmação ao trocar capítulo / recarregar / atualizar lista)
  - beforeunload (alerta ao fechar/refresh com alterações)
  - 401 redirect (limpa tokens e redireciona para /login preservando return path)

## Motivo
- Evitar perda de texto em demo
- Evitar “travamento” por token expirado durante apresentação

## Evidência
- Modal de confirmação exibido ao trocar de capítulo com alterações não salvas (print registrado).
