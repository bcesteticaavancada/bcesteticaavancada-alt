-- BC Gestão — complemento específico de consentimento para Bioestimulador.
-- Migration aditiva: preserva integralmente a versão clínica anteriormente publicada.
-- O conteúdo diferencia produtos/substâncias, exige rastreabilidade e não prescreve técnica,
-- dose, indicação ou manejo automático; a avaliação profissional e a bula/IFU do produto prevalecem.

do $$
declare
  p record;
  v_old public.procedure_versions%rowtype;
  v_new_id uuid;
  v_next integer;
  v_biostimulator text := 'COMPLEMENTO ESPECÍFICO — BIOESTIMULADOR. Declaro que recebi explicações claras sobre o procedimento planejado e compreendo que a expressão bioestimulador pode abranger produtos e substâncias diferentes, com características, indicações, permanência, limitações e perfis de risco próprios. A escolha do produto efetivamente utilizado, sua indicação, a região tratada, a quantidade empregada, a técnica e o planejamento de sessões dependem da avaliação profissional individual e devem respeitar o registro aplicável, a bula ou Instruções de Uso do produto correspondente; este documento e o sistema não definem automaticamente indicação, dose, técnica ou intervalo. Compreendo que a resposta gradual e individual pode variar quanto à intensidade, duração, simetria, textura, contorno e estímulo tecidual, podendo haver necessidade de sessões ou reavaliações, sem garantia de resultado. Fui informada(o) de que podem ocorrer dor, ardência, sensibilidade, vermelhidão, edema, hematoma, assimetria, irregularidade, alteração transitória de sensibilidade, inflamação, infecção, pápulas, nódulos e granulomas. Também podem ocorrer eventos tardios, inclusive reações inflamatórias ou alterações locais que se manifestem semanas, meses ou mais tempo depois, conforme o produto efetivamente utilizado e a resposta individual. Riscos, precauções, contraindicações, interações e cuidados adicionais devem ser avaliados de acordo com a bula ou Instruções de Uso do produto efetivamente utilizado e com as condições clínicas verificadas pela profissional responsável. A ficha da sessão deverá preservar a rastreabilidade clínica, incluindo, quando aplicável, marca, fabricante, substância ou material, lote, validade, quantidade, unidade e região tratada. Fui esclarecida(o) de que não existe reversão universal para bioestimuladores ou materiais injetáveis e que eventual manejo de resultado indesejado ou complicação depende do produto utilizado, do momento de reconhecimento, da gravidade e da avaliação de profissional legalmente habilitado. A possibilidade de uso de qualquer medida específica não deve ser entendida como garantia de reversão ou correção. Compreendo ainda que PMMA possui características e indicações próprias e não deve ser tratado como bioestimulador estético genérico; qualquer produto com indicação ou restrição específica somente poderá ser considerado dentro das condições de uso e registro correspondentes e da avaliação profissional. Devo informar antecedentes relevantes, alergias, medicamentos e substâncias em uso, procedimentos prévios na região, presença de materiais permanentes ou semipermanentes quando conhecidos e alterações recentes de saúde. Diante de dor intensa ou progressiva, alteração importante de cor da pele, sinais de infecção, reação sistêmica, alteração visual, falta de ar ou qualquer sintoma relevante ou inesperado, devo comunicar imediatamente a BC Estética Avançada e procurar atendimento médico quando indicado. Tive oportunidade de fazer perguntas e receber respostas compreensíveis. Este consentimento documenta informação e decisão voluntária, não representa renúncia a direitos e não exonera a responsabilidade da profissional ou do estabelecimento. Consinto com a realização do procedimento nas regiões planejadas e sei que posso retirar meu consentimento antes do início da aplicação.';
begin
  select id,nome,current_version_id
    into p
    from public.procedimentos
   where nome='Bioestimulador'
     and archived_at is null
   order by created_at asc
   limit 1;

  if not found then
    raise exception 'Procedimento Bioestimulador não encontrado.';
  end if;

  select * into v_old
    from public.procedure_versions v
   where v.id = p.current_version_id;

  if not found then
    raise exception 'Versão atual não encontrada para Bioestimulador.';
  end if;

  if v_old.status <> 'published' or v_old.classe_documental <> 'injetavel' then
    raise exception 'Versão atual de Bioestimulador não está publicada como injetável.';
  end if;

  -- Idempotência defensiva para ambientes onde este conteúdo já tenha sido promovido.
  if coalesce(v_old.consent_supplement,'') = v_biostimulator then
    return;
  end if;

  select case when max(v.version) is null then 1 else max(v.version) + 1 end
    into v_next
    from public.procedure_versions v
   where v.procedimento_id = p.id;

  insert into public.procedure_versions(
    procedimento_id,version,status,nome,classe_documental,categoria,descricao,
    price_mode,base_price,suggested_duration,requires_general_anamnesis,
    requires_return,return_interval_days,pre_guidance,post_guidance,consent_supplement,
    specific_schema,technical_schema,protocol_mode,
    requires_photo,requires_product_lot,requires_equipment,
    created_by,published_by,published_at
  ) values (
    v_old.procedimento_id,v_next,'published',v_old.nome,v_old.classe_documental,v_old.categoria,v_old.descricao,
    v_old.price_mode,v_old.base_price,v_old.suggested_duration,v_old.requires_general_anamnesis,
    v_old.requires_return,v_old.return_interval_days,v_old.pre_guidance,v_old.post_guidance,v_biostimulator,
    v_old.specific_schema,v_old.technical_schema,v_old.protocol_mode,
    v_old.requires_photo,v_old.requires_product_lot,v_old.requires_equipment,
    v_old.created_by,v_old.published_by,now()
  ) returning id into v_new_id;

  insert into public.procedure_version_components(parent_version_id,component_version_id,required,sort_order)
  select v_new_id,c.component_version_id,c.required,c.sort_order
    from public.procedure_version_components c
   where c.parent_version_id=v_old.id
  on conflict do nothing;

  update public.procedure_versions
     set status='superseded'
   where id=v_old.id and status='published';

  update public.procedimentos
     set current_version_id=v_new_id,
         nome=v_old.nome,
         duracao_padrao=coalesce(v_old.suggested_duration,duracao_padrao),
         updated_at=now()
   where id=p.id;
end;
$$;
