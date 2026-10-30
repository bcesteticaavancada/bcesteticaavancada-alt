import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  createFixtureAgendaReader,
  type AgendaReader,
  type CatalogProcedure,
  type MonthDay,
  type PublicProfessional,
} from '../services/publicAgenda';
import { colors } from '../theme';

const fixtureReader = createFixtureAgendaReader();

function localToday(): string {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

function calendarMonth(date: string): string {
  return date.slice(0, 7);
}

function moveMonth(month: string, step: number): string {
  const [year, value] = month.split('-').map(Number);
  const next = new Date(year, value - 1 + step, 1);
  return [next.getFullYear(), String(next.getMonth() + 1).padStart(2, '0')].join('-');
}

function dayLabel(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function Choice({ label, active, onPress, disabled = false }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, active && styles.selectedChoice, disabled && styles.disabledChoice]}
    >
      <Text style={[styles.choiceText, active && styles.selectedChoiceText]}>{label}</Text>
    </Pressable>
  );
}

/**
 * A interface recebe o contrato de leitura da Agenda V2, mas a prévia
 * usa exclusivamente a fixture. Nunca criar reservas nesta tela.
 */
export default function AgendaDemo({
  requestedProcedureName,
  reader = fixtureReader,
}: {
  requestedProcedureName: string | null;
  reader?: AgendaReader;
}) {
  const [catalog, setCatalog] = useState<CatalogProcedure[]>([]);
  const [staff, setStaff] = useState<PublicProfessional[]>([]);
  const [days, setDays] = useState<MonthDay[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [procedureId, setProcedureId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [month, setMonth] = useState(() => calendarMonth(localToday()));
  const [loading, setLoading] = useState<string | null>('catálogo');
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading('catálogo');
    setError(null);
    reader.getCatalog()
      .then((items) => {
        if (!active) return;
        setCatalog(items);
        const match = requestedProcedureName
          ? items.find((item) => item.name.toLocaleLowerCase('pt-BR') === requestedProcedureName.toLocaleLowerCase('pt-BR'))
          : undefined;
        setProcedureId(match?.id || null);
      })
      .catch(() => { if (active) setError('Não foi possível carregar a prévia do catálogo.'); })
      .finally(() => { if (active) setLoading(null); });
    return () => { active = false; };
  }, [reader, retry, requestedProcedureName]);

  useEffect(() => {
    let active = true;
    setStaff([]);
    if (!procedureId) return () => { active = false; };
    setLoading('profissionais');
    setError(null);
    reader.getProfessionals(procedureId)
      .then((items) => { if (active) setStaff(items); })
      .catch(() => { if (active) setError('Não foi possível consultar as profissionais de demonstração.'); })
      .finally(() => { if (active) setLoading(null); });
    return () => { active = false; };
  }, [reader, procedureId]);

  useEffect(() => {
    let active = true;
    setDays([]);
    if (!procedureId || !professionalId) return () => { active = false; };
    setLoading('dias');
    setError(null);
    reader.getMonth(procedureId, professionalId, month)
      .then((items) => { if (active) setDays(items); })
      .catch(() => { if (active) setError('Não foi possível consultar os dias de demonstração.'); })
      .finally(() => { if (active) setLoading(null); });
    return () => { active = false; };
  }, [reader, procedureId, professionalId, month]);

  useEffect(() => {
    let active = true;
    setSlots([]);
    if (!procedureId || !professionalId || !date) return () => { active = false; };
    setLoading('horários');
    setError(null);
    reader.getSlots(procedureId, professionalId, date)
      .then((items) => { if (active) setSlots(items); })
      .catch(() => { if (active) setError('Não foi possível consultar os horários de demonstração.'); })
      .finally(() => { if (active) setLoading(null); });
    return () => { active = false; };
  }, [reader, procedureId, professionalId, date]);

  const eligibleDays = useMemo(
    () => days.filter((item) => item.available && item.date >= localToday()),
    [days],
  );
  const selectedProcedure = catalog.find((item) => item.id === procedureId);
  const selectedProfessional = staff.find((item) => item.id === professionalId);

  function chooseProcedure(id: string) {
    setProcedureId(id);
    setProfessionalId(null);
    setDate(null);
    setSlot(null);
  }

  function chooseProfessional(id: string) {
    setProfessionalId(id);
    setMonth(calendarMonth(localToday()));
    setDate(null);
    setSlot(null);
  }

  function chooseMonth(step: number) {
    const next = moveMonth(month, step);
    if (next < calendarMonth(localToday())) return;
    setMonth(next);
    setDate(null);
    setSlot(null);
  }

  function chooseDay(value: string) {
    setDate(value);
    setSlot(null);
  }

  return (
    <View style={styles.content}>
      <View style={styles.editorialHero}>
        <View style={styles.editorialHalo} />
        <Text style={styles.eyebrow}>BC · AGENDA EXCLUSIVA</Text>
        <Text style={styles.heading}>Seu próximo momento de cuidado.</Text>
        <View style={styles.editorialRule} />
        <Text style={styles.subtitle}>Uma experiência de agendamento pensada para você, do início ao fim.</Text>
        <Text style={styles.heroFooter}>01 PROCEDIMENTO  ·  02 PROFISSIONAL  ·  03 DATA  ·  04 HORÁRIO</Text>
      </View>
      <View style={styles.demoBanner}>
        <Text style={styles.demoText}>DADOS 100% FICTÍCIOS · sem consulta ou reserva real</Text>
      </View>
      {requestedProcedureName && !selectedProcedure && catalog.length > 0 ? (
        <Text style={styles.hint}>O procedimento “{requestedProcedureName}” ainda não integra o catálogo fictício. Escolha um exemplo abaixo.</Text>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Choice label="Tentar novamente" active={false} onPress={() => setRetry((value) => value + 1)} />
        </View>
      ) : null}
      {loading ? <Text style={styles.loading}>Carregando {loading} de demonstração…</Text> : null}

      <Text style={styles.step}><Text style={styles.stepNumber}>01  </Text> Escolha seu cuidado</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {catalog.map((item) => (
          <Choice key={item.id} label={item.name} active={procedureId === item.id} onPress={() => chooseProcedure(item.id)} />
        ))}
      </ScrollView>

      <Text style={styles.step}><Text style={styles.stepNumber}>02  </Text> Profissional</Text>
      {!procedureId ? <Text style={styles.hint}>Escolha um procedimento primeiro.</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {staff.map((item) => (
          <Choice key={item.id} label={item.name} active={professionalId === item.id} onPress={() => chooseProfessional(item.id)} />
        ))}
      </ScrollView>

      <Text style={styles.step}><Text style={styles.stepNumber}>03  </Text> Seu dia preferido</Text>
      <View style={styles.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" disabled={month <= calendarMonth(localToday())} onPress={() => chooseMonth(-1)} style={styles.arrowButton}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{new Date(month + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => chooseMonth(1)} style={styles.arrowButton}>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>
      {!professionalId ? <Text style={styles.hint}>Selecione uma profissional para visualizar os dias.</Text> : null}
      {professionalId && !loading && eligibleDays.length === 0 ? <Text style={styles.hint}>Não há dias disponíveis nesta simulação para o mês selecionado.</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {eligibleDays.map((item) => (
          <Choice key={item.date} label={dayLabel(item.date)} active={date === item.date} onPress={() => chooseDay(item.date)} />
        ))}
      </ScrollView>

      <Text style={styles.step}><Text style={styles.stepNumber}>04  </Text> Horário preferido</Text>
      {!date ? <Text style={styles.hint}>Selecione um dia para visualizar os horários.</Text> : null}
      <View style={styles.hours}>
        {slots.map((item) => (
          <Choice key={item} label={item} active={slot === item} onPress={() => setSlot(item)} />
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryEyebrow}>RESUMO BC  ✧</Text>
        <Text style={styles.summaryTitle}>Sua experiência começa aqui</Text>
        <Text style={styles.summaryText}>{selectedProcedure?.name || 'Procedimento não selecionado'}</Text>
        <Text style={styles.summaryText}>Profissional: {selectedProfessional?.name || 'não selecionada'}</Text>
        <Text style={styles.summaryText}>Dia: {date ? dayLabel(date) : 'não selecionado'} · {slot || 'sem horário'}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !procedureId || !professionalId || !date || !slot }}
        disabled={!procedureId || !professionalId || !date || !slot}
        style={[styles.action, (!procedureId || !professionalId || !date || !slot) && styles.actionDisabled]}
        onPress={() => Alert.alert('Simulação concluída', 'Você percorreu as etapas da agenda nativa. Nenhum horário foi reservado e nenhum dado foi enviado.')}
      >
        <Text style={styles.actionText}>Conferir simulação ›</Text>
      </Pressable>
      <Text style={styles.footer}>A disponibilidade verdadeira, o nome das profissionais e a confirmação de agendamento serão ligados somente após a homologação clínica e de segurança.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  editorialHero: { backgroundColor: '#5B3647', borderRadius: 20, padding: 22, gap: 12, overflow: 'hidden', minHeight: 226 },
  editorialHalo: { width: 210, height: 210, position: 'absolute', right: -95, top: -60, borderRadius: 105, borderWidth: 1, borderColor: 'rgba(233,187,159,0.35)' },
  editorialRule: { width: 62, height: 2, borderRadius: 2, backgroundColor: '#E4B69C' },
  heroFooter: { color: '#E7C3B1', fontSize: 8, letterSpacing: 0.6, lineHeight: 14, fontWeight: '800', paddingTop: 4 },
  stepNumber: { color: '#C5947D', fontFamily: 'serif', fontWeight: '700', fontSize: 20 },
  summaryEyebrow: { color: '#E6B99E', fontWeight: '800', letterSpacing: 1.7, fontSize: 10 },
  content: { paddingHorizontal: 20, paddingTop: 23, paddingBottom: 24, gap: 12 },
  eyebrow: { color: '#E6BFA7', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heading: { color: '#FFF6F1', fontSize: 31, lineHeight: 37, fontWeight: '600', fontFamily: 'serif', maxWidth: 270 },
  subtitle: { color: '#F0DDE0', fontSize: 12, lineHeight: 19, marginBottom: 4 },
  demoBanner: { backgroundColor: '#F6E4DF', padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#E9C9BE' },
  demoText: { color: colors.roseDeep, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  step: { marginTop: 18, color: '#5A3443', fontSize: 16, fontWeight: '800', paddingBottom: 8, borderBottomWidth: 1, borderColor: '#E5CEC5' },
  options: { gap: 9, paddingVertical: 4 },
  choice: { backgroundColor: '#FFFDFC', borderWidth: 1, borderColor: '#DDBFB3', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 15 },
  selectedChoice: { backgroundColor: '#824E60', borderColor: '#C3917E' },
  disabledChoice: { opacity: 0.45 },
  choiceText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  selectedChoiceText: { color: '#FFFFFF' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  loading: { color: colors.roseDeep, fontSize: 12 },
  errorBox: { padding: 12, borderRadius: 9, backgroundColor: '#FFF2F0', gap: 8 },
  errorText: { color: '#912E3D', fontSize: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9EEE9', padding: 6, borderRadius: 13 },
  monthLabel: { color: colors.ink, textTransform: 'capitalize', fontSize: 13, fontWeight: '700' },
  arrowButton: { width: 45, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.blush },
  arrow: { color: colors.roseDeep, fontSize: 26 },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  summary: { backgroundColor: '#593645', borderColor: '#BE8E81', borderWidth: 1, borderRadius: 18, padding: 20, gap: 10, marginTop: 17 },
  summaryTitle: { color: '#FFF6F2', fontFamily: 'serif', fontWeight: '700', fontSize: 21, marginBottom: 4 },
  summaryText: { color: '#F0DDE0', fontSize: 12, lineHeight: 19 },
  action: { backgroundColor: '#D3A085', borderRadius: 25, padding: 18, borderWidth: 1, borderColor: '#E5B99F' },
  actionDisabled: { opacity: 0.45 },
  actionText: { color: '#442B37', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
});
