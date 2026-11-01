-- Challenge I: o júri (código de júri no cabeçalho x-inov-code) pode ver a lista de ficheiros dos membros e abri-los (só leitura).
create policy docs_juri_materiais on public.docs for select to anon, authenticated
  using (col = 'materiais' and (select public.inov_juri()));
create policy mat_sel_juri on storage.objects for select to anon, authenticated
  using (bucket_id = 'materiais' and (select public.inov_juri()));
