-- BC Gestão — complemento específico de consentimento para preenchimento/harmonização.
-- Migration aditiva: preserva integralmente a versão clínica anteriormente publicada.
-- Conteúdo alinhado a alertas regulatórios vigentes sobre preenchedores dérmicos,
-- rastreabilidade e complicações vasculares; revisão clínica/jurídica institucional permanece recomendada.

do $$
declare
  p record;
  v_old public.procedure_versions%rowtype;
  v_new_id uuid;
  v_next integer;
  v_filler text := 'COMPLEMENTO ESPECÍFICO — PREENCHEDORES DÉRMICOS / HARMONIZAÇÃO FACIAL. Declaro que recebi explicações claras sobre o procedimento planejado e compreendo que a expressão harmonização facial ou preenchimento pode envolver diferentes preenchedores dérmicos, cujas características, indicações, permanência, limitações e riscos não são iguais. Entre os materiais existentes podem estar ácido hialurônico, hidroxiapatita de cálcio, PLLA e PMMA, sem que esta menção signifique indicação automática ou que todos sejam apropriados para o meu caso. A escolha do produto efetivamente utilizado, sua indicação, a região anatômica tratada, a quantidade empregada e a técnica devem decorrer da avaliação profissional individual e respeitar as Instruções de Uso, o registro na Anvisa e as condições de uso do produto correspondente. Compreendo que o resultado é individual, não é garantido e pode variar quanto a volume, contorno, simetria, duração, textura e resposta tecidual, podendo haver necessidade de reavaliação. Fui informada(o) de que podem ocorrer dor, ardência, sensibilidade, vermelhidão, edema, hematoma, assimetria, alteração transitória de sensibilidade, inflamação, infecção, pápulas, nódulos, granulomas, irregularidades, alteração de textura ou pigmentação e migração do material, além de eventos tardios que podem surgir semanas, meses ou mais tempo depois, conforme o produto e a resposta individual. Fui especialmente esclarecida(o) de que, embora raras, complicações vasculares podem ser graves. A introdução ou compressão inadvertida de um vaso pode causar oclusão vascular, isquemia, necrose tecidual e, em situações graves, deficiência visual temporária ou permanente, além de outras complicações que exigem avaliação e atendimento imediato. Diante de dor incomum ou intensa, pele branca, cinza ou azulada próxima à área tratada, alteração visual súbita, fraqueza, alteração da fala ou qualquer sinal neurológico durante ou após o procedimento, devo comunicar imediatamente a profissional e procurar atendimento médico imediatamente, informando que fui submetida(o) a procedimento com preenchedor dérmico e levando, quando possível, os dados do produto. A ficha da sessão deverá preservar a rastreabilidade clínica do material utilizado, incluindo marca, fabricante, lote, validade, quantidade e unidade registradas. Compreendo também a importância de receber o cartão de rastreabilidade ou identificação equivalente do produto quando aplicável e de manter esses dados disponíveis para atendimentos futuros. Fui esclarecida(o) de que não há garantia de reversão de um preenchedor. A hialuronidase pode ter aplicação em situações relacionadas a determinados produtos à base de ácido hialurônico, conforme avaliação profissional e circunstâncias clínicas, mas não constitui reversão universal e não deve ser interpretada como garantia de correção para outros materiais. O manejo de qualquer complicação depende do produto efetivamente utilizado, do momento de reconhecimento, da gravidade e da avaliação por profissional legalmente habilitado. Informei antecedentes relevantes, alergias, medicamentos e substâncias em uso, procedimentos prévios na região, presença de materiais permanentes ou semipermanentes quando conhecidos e alterações recentes de saúde. Tive oportunidade de fazer perguntas e receber respostas compreensíveis. Este consentimento documenta informação e decisão voluntária, não representa renúncia a direitos nem exoneração de responsabilidade da profissional ou do estabelecimento. Consinto com a realização do procedimento nas regiões planejadas e sei que posso retirar meu consentimento antes do início da aplicação.';
begin
  select id,nome,current_version_id
    into p
    from public.procedimentos
   where nome='Harmonização Facial / Preenchimento'
     and archived_at is null
   order by created_at asc
   limit 1;

  if not found then
    raise exception 'Procedimento Harmonização Facial / Preenchimento não encontrado.';
  end if;

  select * into v_old
    from public.procedure_versions v
   where v.id = p.current_version_id;

  if not found then
    raise exception 'Versão atual não encontrada para Harmonização Facial / Preenchimento.';
  end if;

  if v_old.status <> 'published' or v_old.classe_documental <> 'injetavel' then
    raise exception 'Versão atual de Harmonização Facial / Preenchimento não está publicada como injetável.';
  end if;

  -- Idempotência defensiva para ambientes onde este conteúdo já tenha sido promovido.
  if coalesce(v_old.consent_supplement,'') = v_filler then
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
    v_old.requires_return,v_old.return_interval_days,v_old.pre_guidance,v_old.post_guidance,v_filler,
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
