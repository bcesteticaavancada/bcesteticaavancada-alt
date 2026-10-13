-- BC Gestão — reforço documental pós-6D.
-- Publica TCLEs institucionais v2 e complemento específico de Toxina Botulínica Tipo A.
-- Preserva integralmente templates e versões de procedimento já publicados.
-- Referências clínicas/regulatórias para revisão de conteúdo: orientações vigentes da Anvisa
-- sobre toxina botulínica, rastreabilidade, bula, sinais de botulismo e atendimento imediato.

insert into public.consent_template_versions(consent_class,version,title,body,status)
values
(
  'nao_injetavel',
  2,
  'Termo de Consentimento Livre e Esclarecido — Procedimento Estético Não Injetável',
  'Declaro que recebi explicações claras e suficientes sobre o procedimento estético não injetável identificado neste documento, incluindo sua finalidade, natureza, etapas previstas, produtos ou equipamentos que possam ser utilizados e alternativas possíveis, inclusive a opção de não realizar o procedimento. Compreendo que a resposta é individual e que o resultado não é garantido, podendo variar em intensidade, duração e aparência. Fui informada(o) de que, conforme a técnica, a região tratada, o produto e o equipamento empregados, podem ocorrer desconforto, sensibilidade, dor, vermelhidão, edema, hematoma, ressecamento, descamação ou alterações transitórias da pele, bem como reações inflamatórias ou alérgicas, alteração de pigmentação, lesão térmica ou irritativa e, quando aplicável, infecção ou outra intercorrência que demande reavaliação. Comprometo-me a informar antes da sessão mudanças no meu estado de saúde, uso de medicamentos ou substâncias, alergias, gestação ou amamentação quando aplicável, lesões ou infecções na pele e procedimentos recentes que possam interferir na avaliação profissional. Quando houver cosmético, insumo ou equipamento, compreendo que sua seleção deve respeitar a avaliação individual, a regularização aplicável e as instruções de uso correspondentes. Recebi ou terei acesso às orientações pré e pós-procedimento definidas pela profissional responsável e comprometo-me a segui-las. Sei que sinais inesperados, piora importante, dor intensa, reação relevante ou qualquer intercorrência devem ser comunicados à BC Estética Avançada e podem exigir suspensão do plano, reavaliação ou encaminhamento para atendimento adicional. Tive oportunidade de fazer perguntas e receber respostas compreensíveis. Este consentimento registra informação e decisão voluntária, não representa renúncia a direitos nem exoneração de responsabilidade da profissional ou do estabelecimento. Consinto com a realização do procedimento descrito e sei que posso retirar meu consentimento antes do início da sessão.',
  'published'
),
(
  'injetavel',
  2,
  'Termo de Consentimento Livre e Esclarecido — Procedimento Estético Injetável ou Invasivo',
  'Declaro que recebi explicações claras e suficientes sobre o procedimento estético injetável ou invasivo identificado neste documento, incluindo finalidade, técnica ou via prevista, regiões planejadas, alternativas possíveis e a opção de não realizar o procedimento. Compreendo que a resposta é individual e que o resultado não é garantido, podendo variar em intensidade, duração, simetria e aparência. Fui informada(o) de que procedimentos injetáveis ou invasivos podem causar dor, ardência, sangramento, sensibilidade, vermelhidão, edema, hematoma, assimetria ou alteração transitória de função ou sensibilidade. Conforme a técnica e o produto efetivamente utilizados, também podem ocorrer infecção, reação inflamatória ou reação alérgica, nódulos, alteração de pigmentação, resultado insuficiente ou excessivo e outros eventos inesperados que possam exigir reavaliação, atendimento adicional, intervenção profissional ou encaminhamento. Comprometo-me a informar previamente mudanças no meu estado de saúde, uso de medicamentos ou substâncias, alergias, antecedentes relevantes, procedimentos recentes e demais informações solicitadas pela profissional. Quando houver produto, compreendo que deverá ser utilizado produto regularizado e selecionado pela profissional responsável segundo indicação individual e bula ou instrução aplicável. A rastreabilidade clínica deverá registrar, quando pertinente, marca, fabricante, lote e validade do produto empregado, além da quantidade ou unidade registrada na sessão. Entendo que contraindicações, precauções, interações, intervalos e cuidados específicos dependem do procedimento e da bula do produto efetivamente utilizado e devem ser avaliados pela profissional responsável. Recebi ou terei acesso às orientações pré e pós-procedimento e comprometo-me a segui-las. Qualquer intercorrência deve ser comunicada à BC Estética Avançada e pode exigir suspensão, reavaliação ou encaminhamento. Tive oportunidade de fazer perguntas e receber respostas compreensíveis. Este consentimento registra informação e decisão voluntária, não representa renúncia a direitos nem exoneração de responsabilidade da profissional ou do estabelecimento. Consinto com a realização do procedimento descrito e sei que posso retirar meu consentimento antes do início da sessão.',
  'published'
)
on conflict (consent_class,version) do nothing;

do $$
declare
  p record;
  v_old public.procedure_versions%rowtype;
  v_new_id uuid;
  v_next integer;
  v_botox text := 'COMPLEMENTO ESPECÍFICO — TOXINA BOTULÍNICA TIPO A. Declaro que fui informada(o) de que a toxina botulínica tipo A tem efeito temporário sobre a contração muscular nas áreas planejadas e que resposta, intensidade, simetria e duração variam entre pessoas, sem garantia de resultado. Antes da aplicação, devo informar à profissional meu histórico de aplicações de toxina botulínica, incluindo, quando conhecidos, data, indicação e dose, além do produto utilizado, resposta obtida, intercorrências anteriores, medicamentos em uso, alergias, condições neuromusculares, alterações recentes de saúde e outras informações solicitadas na avaliação. Compreendo que contraindicações, precauções, interações, dose, indicação, intervalo entre aplicações e cuidados específicos devem respeitar a avaliação profissional e a bula do produto efetivamente utilizado; este sistema não define dose ou indicação automaticamente. O produto utilizado deve ser regularizado, estar dentro do prazo de validade e ser rastreável; a ficha da sessão registrará, quando disponíveis, marca, fabricante, lote e validade, além dos demais dados técnicos pertinentes. Fui esclarecida(o) de que podem ocorrer dor, ardência, sensibilidade, vermelhidão, edema, hematoma, cefaleia e desconforto local. Também podem ocorrer assimetria, resultado insuficiente ou excessivo, fraqueza temporária de músculos próximos, alteração transitória da expressão e, conforme a região tratada, queda de sobrancelha ou pálpebra, alterações visuais, da fala ou da deglutição. Fui especialmente informada(o) de que existe risco raro, porém potencialmente grave, de disseminação do efeito da toxina para regiões distantes da aplicação e de botulismo iatrogênico. Sinais de alerta podem surgir horas ou semanas após a aplicação e incluem visão borrada ou dupla, pálpebras caídas, fala arrastada, dificuldade para engolir, dificuldade para respirar e fraqueza muscular generalizada. Na presença desses sinais devo procurar atendimento médico imediatamente e informar que recebi toxina botulínica, levando, se possível, os dados de marca, fabricante, lote e validade do produto. Entendo que qualquer retoque ou nova aplicação depende de reavaliação da profissional responsável e do intervalo indicado na bula do produto efetivamente utilizado, não havendo direito automático a reaplicação por expectativa estética. Recebi orientação para comunicar intercorrências à BC Estética Avançada e buscar atendimento de urgência diante dos sinais de alarme descritos. Tive oportunidade de fazer perguntas, compreendi os benefícios esperados, limitações e riscos e consinto voluntariamente com a aplicação nas áreas planejadas. Posso retirar meu consentimento antes do procedimento. Este documento não constitui renúncia a direitos nem exoneração de responsabilidade profissional ou do estabelecimento.';
begin
  for p in
    select id,nome,current_version_id
      from public.procedimentos
     where nome in ('Botox terço superior','Botox full face','Botox Nefertiti')
       and archived_at is null
     order by nome
  loop
    select * into v_old
      from public.procedure_versions v
     where v.id = p.current_version_id;

    if not found then
      raise exception 'Versão atual não encontrada para %.', p.nome;
    end if;
    if v_old.status <> 'published' or v_old.classe_documental <> 'injetavel' then
      raise exception 'Versão atual de % não está publicada como injetável.', p.nome;
    end if;

    -- Idempotência defensiva para ambientes onde o mesmo conteúdo já tenha sido promovido.
    if coalesce(v_old.consent_supplement,'') = v_botox then
      continue;
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
      v_old.requires_return,v_old.return_interval_days,v_old.pre_guidance,v_old.post_guidance,v_botox,
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
  end loop;
end;
$$;
