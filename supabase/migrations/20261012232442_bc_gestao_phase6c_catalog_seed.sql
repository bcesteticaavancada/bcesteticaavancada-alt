-- BC Gestão Fase 6C — catálogo clínico inicial oficial da BC.
-- Preserva IDs operacionais e histórico; não concede permissão clínica automaticamente.

do $$
declare
  r record;
  v_procedure_id uuid;
  v_version_id uuid;
  v_specific jsonb;
  v_technical jsonb;
  v_description text;
  v_steps jsonb;
  v_phase6d jsonb;
begin
  for r in
    select * from (values
      ('Limpeza de pele','nao_injetavel','fixed',190,'facial','simple','{}'::jsonb),
      ('Limpeza de pele com peeling','nao_injetavel','fixed',219,'facial','simple','{}'::jsonb),
      ('Massagem (relaxante, drenagem ou redutora)','nao_injetavel','fixed',195,'corporal','simple','{"extra_fields":[{"key":"modalidade","label":"Modalidade","type":"select","required":true,"options":["relaxante","drenagem","redutora"]}]}'::jsonb),
      ('Peeling','nao_injetavel','starting_at',195,'facial','simple','{}'::jsonb),
      ('Black peel','nao_injetavel','fixed',390,'facial','simple','{}'::jsonb),
      ('Despigmentação','nao_injetavel','starting_at',250,'facial','simple','{}'::jsonb),
      ('Botox terço superior','injetavel','fixed',990,'injetaveis','simple','{}'::jsonb),
      ('Botox full face','injetavel','fixed',1390,'injetaveis','simple','{}'::jsonb),
      ('Botox Nefertiti','injetavel','fixed',690,'injetaveis','simple','{}'::jsonb),
      ('Skinbooster','injetavel','starting_at',490,'injetaveis','simple','{}'::jsonb),
      ('Bioestimulador','injetavel','starting_at',1390,'injetaveis','simple','{}'::jsonb),
      ('Aplicação de enzimas','injetavel','starting_at',390,'injetaveis','simple','{}'::jsonb),
      ('Profhilo','injetavel','fixed',990,'injetaveis','simple','{}'::jsonb),
      ('Microagulhamento','injetavel','starting_at',490,'facial','simple','{}'::jsonb),
      ('Ultrassom microfocado','nao_injetavel','starting_at',990,'tecnologias','simple','{}'::jsonb),
      ('Radiofrequência / criofrequência fracionada','nao_injetavel','starting_at',490,'tecnologias','simple','{}'::jsonb),
      ('Fort Hair™','nao_injetavel','fixed',490,'protocolos_bc','compound','{"component_options":[{"key":"ativos_topicos","label":"Ativos/veiculação não invasiva","classe_documental":"nao_injetavel"},{"key":"led","label":"LED","classe_documental":"nao_injetavel"},{"key":"microestimulacao_invasiva","label":"Microestimulação com agulhas/inserção","classe_documental":"injetavel"}]}'::jsonb),
      ('Fort Hair Plus™','injetavel','fixed',990,'protocolos_bc','simple','{}'::jsonb),
      ('Fort Brow™','nao_injetavel','fixed',390,'protocolos_bc','compound','{"component_options":[{"key":"nao_invasivo","label":"Etapa não invasiva","classe_documental":"nao_injetavel"},{"key":"microestimulacao_invasiva","label":"Microestimulação com agulhas/inserção","classe_documental":"injetavel"}]}'::jsonb),
      ('Sculpt Cryo™','nao_injetavel','fixed',590,'protocolos_bc','simple','{}'::jsonb),
      ('Reset Glow™','nao_injetavel','fixed',190,'protocolos_bc','simple','{}'::jsonb),
      ('Monaco Glow™','nao_injetavel','fixed',890,'protocolos_bc','compound','{"component_options":[{"key":"via_nao_invasiva","label":"Componente/via não invasiva","classe_documental":"nao_injetavel"},{"key":"via_injetavel","label":"Componente/via injetável ou invasiva","classe_documental":"injetavel"}]}'::jsonb),
      ('Skin Reset™','injetavel','starting_at',1990,'protocolos_bc','simple','{}'::jsonb),
      ('Face Reset™','injetavel','starting_at',2990,'protocolos_bc','simple','{}'::jsonb),
      ('Jato de Plasma','nao_injetavel','starting_at',190,'tecnologias','simple','{}'::jsonb),
      ('Harmonização Facial / Preenchimento','injetavel','starting_at',990,'injetaveis','simple','{}'::jsonb),
      ('Lipo de Papada','injetavel','starting_at',390,'injetaveis','simple','{}'::jsonb),
      ('Tratamento para Estrias','injetavel','starting_at',390,'corporal','simple','{}'::jsonb),
      ('Tratamento de Vasinhos','nao_injetavel','fixed',180,'corporal','compound','{"component_options":[{"key":"nao_invasivo","label":"Técnica não invasiva","classe_documental":"nao_injetavel"},{"key":"aplicacao_injetavel","label":"Aplicação injetável","classe_documental":"injetavel"}]}'::jsonb),
      ('Remoção a Laser','nao_injetavel','starting_at',250,'laser','simple','{}'::jsonb)
    ) as c(nome,classe_documental,price_mode,base_price,categoria,protocol_mode,specific_extra)
  loop
    v_specific := jsonb_build_object(
      'version',1,
      'fields',jsonb_build_array(
        jsonb_build_object('key','objetivo_sessao','label','Objetivo desta sessão','type','textarea','required',true),
        jsonb_build_object('key','area_regiao','label','Área/região planejada','type','text','required',true),
        jsonb_build_object('key','observacao_avaliacao','label','Observação da avaliação profissional','type','textarea','required',false)
      )
    ) || coalesce(r.specific_extra,'{}'::jsonb);

    if jsonb_typeof(r.specific_extra->'extra_fields')='array' then
      v_specific := jsonb_set(v_specific,'{fields}',(v_specific->'fields') || (r.specific_extra->'extra_fields')) - 'extra_fields';
    end if;
    if r.protocol_mode='compound' then
      v_specific := jsonb_set(v_specific,'{fields}',(v_specific->'fields') || jsonb_build_array(
        jsonb_build_object('key','componentes_sessao','label','Componentes/técnicas usados nesta sessão','type','multiselect','required',true)
      ));
    end if;

    v_description := case r.nome
      when 'Fort Hair™' then 'Protocolo capilar intensivo da BC com ativos de alta performance, microestimulação, LED e tecnologias voltadas ao folículo; a classe final depende dos componentes efetivamente usados.'
      when 'Fort Hair Plus™' then 'Protocolo capilar BC estruturado em fios de PDO + bioestimulação, eletroporação e homecare direcionado.'
      when 'Fort Brow™' then 'Protocolo BC de reconstrução de sobrancelhas; a técnica e a classe documental dependem dos componentes efetivamente selecionados.'
      when 'Sculpt Cryo™' then 'Protocolo corporal BC para gordura localizada e flacidez com criofrequência.'
      when 'Reset Glow™' then 'Protocolo BC voltado a hidratação, nutrição, revitalização e glow da pele.'
      when 'Monaco Glow™' then 'Protocolo biorremodelador da BC em ciclo informado de quatro sessões; a via de aplicação deve ser selecionada na sessão, não presumida pelo sistema.'
      when 'Skin Reset™' then 'Protocolo BC que combina bioestimulação de colágeno e microagulhamento.'
      when 'Face Reset™' then 'Protocolo facial progressivo BC que pode integrar toxina botulínica, preenchimento e etapas individualizadas.'
      else r.nome || ' — procedimento/protocolo cadastrado pela BC, com execução condicionada à avaliação profissional.'
    end;

    v_steps := case
      when r.nome like 'Botox %' then '["Confirmar Anamnese Geral e avaliação profissional.","Registrar análise facial, áreas planejadas e marcação.","Registrar produto/lote futuramente na etapa 6D.","Executar conforme plano profissional, sem dose automática do sistema.","Registrar resposta, orientações e retorno quando indicado."]'::jsonb
      when r.nome='Harmonização Facial / Preenchimento' then '["Confirmar Anamnese Geral e avaliação profissional.","Registrar análise facial, áreas e plano.","Registrar produto/lote futuramente na etapa 6D.","Executar conforme técnica e produto selecionados.","Registrar resposta, orientações e retorno."]'::jsonb
      when r.nome='Lipo de Papada' then '["Confirmar Anamnese Geral e avaliação profissional.","Registrar região e objetivo.","Registrar produto/lote futuramente na etapa 6D.","Executar conforme protocolo profissional e instruções aplicáveis.","Registrar resposta, orientações e retorno."]'::jsonb
      when r.nome='Tratamento para Estrias' then '["Confirmar avaliação e Anamnese Geral vigente.","Registrar tipo, aspecto, área e histórico informado.","Selecionar e registrar técnica da sessão.","Executar conforme protocolo definido pela profissional.","Registrar resposta e orientações."]'::jsonb
      when r.nome='Tratamento de Vasinhos' then '["Confirmar avaliação profissional.","Registrar região e mapeamento da sessão.","Selecionar e registrar técnica efetivamente utilizada.","Executar conforme protocolo profissional.","Registrar resposta e orientações."]'::jsonb
      when r.nome='Remoção a Laser' then '["Confirmar avaliação e objetivo.","Registrar área e características observadas.","Registrar proteção ocular e equipamento/parâmetros futuramente na etapa 6D.","Executar conforme protocolo do equipamento e decisão profissional.","Registrar resposta e orientações."]'::jsonb
      when r.categoria='injetaveis' then '["Confirmar Anamnese Geral e avaliação profissional.","Registrar área e objetivo.","Registrar produto/lote futuramente na etapa 6D.","Executar conforme técnica e instrução aplicável.","Registrar resposta, orientações e retorno."]'::jsonb
      when r.categoria in ('tecnologias','laser') then '["Confirmar avaliação profissional.","Registrar área e objetivo.","Registrar equipamento/parâmetros futuramente na etapa 6D.","Executar conforme protocolo do equipamento.","Registrar resposta e orientações."]'::jsonb
      when r.categoria='protocolos_bc' then '["Confirmar avaliação e Anamnese Geral vigente quando exigida.","Registrar etapas/componentes planejados para a sessão.","Executar somente etapas definidas pela profissional responsável.","Registrar resposta e orientações."]'::jsonb
      else '["Confirmar avaliação profissional e Anamnese Geral vigente quando exigida.","Registrar objetivo e condições observadas.","Executar o protocolo definido pela profissional.","Registrar resposta e orientações pós-sessão."]'::jsonb
    end;

    v_phase6d := jsonb_build_object(
      'photo', r.nome in ('Botox terço superior','Botox full face','Botox Nefertiti','Harmonização Facial / Preenchimento','Lipo de Papada','Tratamento para Estrias','Tratamento de Vasinhos','Remoção a Laser'),
      'product_lot', r.classe_documental='injetavel' or r.protocol_mode='compound',
      'equipment', r.categoria in ('tecnologias','laser') or r.nome in ('Sculpt Cryo™','Fort Hair™','Fort Hair Plus™')
    );

    v_technical := jsonb_build_object('version',1,'reference_source','BC','reference_steps',v_steps,'phase6d',v_phase6d);

    select p.id into v_procedure_id
      from public.procedimentos p
     where lower(trim(p.nome))=lower(trim(r.nome))
     order by p.created_at limit 1;

    if v_procedure_id is null then
      insert into public.procedimentos(nome,ativo,duracao_padrao,created_by,archived_at)
      values(r.nome,true,null,null,null)
      returning id into v_procedure_id;
    end if;

    select v.id into v_version_id
      from public.procedure_versions v
     where v.procedimento_id=v_procedure_id and v.version=1
     limit 1;

    if v_version_id is null then
      insert into public.procedure_versions(
        procedimento_id,version,status,nome,classe_documental,categoria,descricao,
        price_mode,base_price,suggested_duration,requires_general_anamnesis,
        requires_return,return_interval_days,pre_guidance,post_guidance,consent_supplement,
        specific_schema,technical_schema,protocol_mode,
        requires_photo,requires_product_lot,requires_equipment,
        created_by,published_by,published_at
      ) values (
        v_procedure_id,1,'published',r.nome,r.classe_documental,r.categoria,v_description,
        r.price_mode,r.base_price,null,true,false,null,
        'Confirmar avaliação profissional, Anamnese Geral vigente quando exigida e orientações individualizadas antes da sessão.',
        'Registrar e entregar as orientações pós-procedimento definidas pela profissional conforme técnica, produto e equipamento efetivamente utilizados.',
        null,v_specific,v_technical,r.protocol_mode,
        coalesce((v_phase6d->>'photo')::boolean,false),
        coalesce((v_phase6d->>'product_lot')::boolean,false),
        coalesce((v_phase6d->>'equipment')::boolean,false),
        null,null,now()
      ) returning id into v_version_id;
    end if;

    update public.procedimentos
       set nome=r.nome, ativo=true, current_version_id=v_version_id, archived_at=null, updated_at=now()
     where id=v_procedure_id;
  end loop;
end;
$$;

-- Hidratação Facial é apenas alias histórico de Reset Glow™, não serviço ativo separado.
insert into public.procedure_aliases(procedimento_id,alias,historical)
select p.id,'Hidratação Facial',true from public.procedimentos p
where lower(trim(p.nome))=lower('Reset Glow™')
on conflict do nothing;

-- Legados são arquivados, nunca apagados.
update public.procedimentos set ativo=false, archived_at=coalesce(archived_at,now()), updated_at=now() where lower(trim(nome))=lower('Drenagem Linfatica');
update public.procedimentos set ativo=false, archived_at=coalesce(archived_at,now()), updated_at=now() where lower(trim(nome))=lower('Massagem Redutora');
update public.procedimentos set ativo=false, archived_at=coalesce(archived_at,now()), updated_at=now() where lower(trim(nome))=lower('Massagem Relaxante');
update public.procedimentos set ativo=false, archived_at=coalesce(archived_at,now()), updated_at=now() where lower(trim(nome))=lower('Procedimento Homologação');