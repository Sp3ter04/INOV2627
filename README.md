# INOV2627 · Dashboard do Departamento de Inovação (JUNITEC 26/27)

Bootcamp (sessões de ideação com júri ao vivo), Apollo, Unicorn Day, KPIs dos membros, MBR e definições.

## Endereços
- `/` · área do coordenador (pede o código de coordenador).
- `/juri` · painel do júri: avaliar (Matar, Analisar o mercado, Gosto, Personalizado), perguntas, e registar/editar/apagar ideias. Sem acesso à vista de coordenador.

## Como está feito
- `src/app.html` · a app (HTML/CSS/JS num só ficheiro). É o mesmo código do artifact do Claude.
- `web/adapter.js` · liga a app ao Supabase, imitando a API `window.claude` do artifact.
- `scripts/build.py` · gera `public/` (o que a Vercel serve). Correr depois de mudar `src/` ou `web/`.
- `supabase/migrations/` · tabela `docs` e regras de acesso (RLS).
- `qa/web.mjs` · teste Playwright com Supabase simulado.

## Acessos (decididos no Supabase, não no browser)
| Quem | Lê | Escreve |
|---|---|---|
| Qualquer pessoa (júri, `/juri`) | ideias, sessões, live, fotos, config, feedback | ideias, feedback |
| Coordenador (código) | tudo | tudo |

O CRM, os KPIs, os perfis, o MBR, as startups e os contactos só são lidos com o código de coordenador.

## Deploy
Push para `main` → a Vercel publica `public/`. Sem build.

## Cópias de segurança
Definições → "Cópia de segurança (versão web)": descarregar tudo em JSON ou repor a partir de um ficheiro.
