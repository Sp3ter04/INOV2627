# Centralização — plataforma central de Inovação

Ramo de trabalho `centralizacao`. Aqui evolui-se o site INOV2627 para a plataforma central
do Departamento de Inovação (ideação, Hub, APOLLO, Unicorn Day, CRM), sem mexer no site em produção.

- Arquitetura proposta (Claude Doc): https://claude.ai/artifact/4k6NWU3WYS34cyQrNogAYE
- Site em produção (ramo `main`): https://inovacao-sandy.vercel.app/juri · /coordenador
- Base de dados: Supabase `inov2627` (hggrgaktnacmmgmaoeib)

## Regras deste ramo
1. O site em produção só muda a partir do ramo `main` (pasta `site`).
2. Trabalho novo da centralização fica neste ramo. Push para `centralizacao` gera apenas uma
   pré-visualização na Vercel (protegida), nunca mexe no link do júri.
3. Correções feitas no `main` entram aqui com `git merge main`.
4. Quando estiver pronto: `git checkout main && git merge centralizacao && git push` → deploy.
5. Mudanças de base de dados: novo ficheiro em `supabase/migrations/` (nunca editar os antigos);
   usar tabelas/coleções novas para não partir o site atual.
