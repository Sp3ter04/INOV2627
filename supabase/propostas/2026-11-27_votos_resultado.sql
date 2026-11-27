-- Resultados da votação "Melhor Pitch" (/votar). Os votos entram em docs(col='pedidos', id='voto__<nome>')
-- (o anónimo já pode inserir em 'pedidos' mas não ler nem alterar). Esta função devolve só as contagens
-- e só com a palavra-passe certa (guardada como hash SHA-256).
create or replace function public.votos_resultado(p text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if encode(digest(convert_to(coalesce(p,''),'utf8'),'sha256'),'hex') <> 'ad0ec2cbe72726ccab26050f4415ec133abb5127e018c530403b09405ead90d7' then
    raise exception 'pass';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('ideia',ideia,'n',n) order by n desc)
    from (select data->>'ideia' as ideia, count(*)::int as n
          from docs where col='pedidos' and id like 'voto\_\_%' escape '\' group by 1) t),'[]'::jsonb);
end $$;
revoke all on function public.votos_resultado(text) from public;
grant execute on function public.votos_resultado(text) to anon, authenticated;
