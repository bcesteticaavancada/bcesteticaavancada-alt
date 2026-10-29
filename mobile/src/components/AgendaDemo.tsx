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
      <Text style={styles.eyebrow}>AGENDA · PRÉVIA NATIVA</Text>
      <Text style={styles.heading}>Seu próximo cuidado</Text>
      <Text style={styles.subtitle}>Percorra o catálogo, escolha uma profissional, um dia e um horário de exemplo.</Text>
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

      <Text style={styles.step}>1. Procedimento</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {catalog.map((item) => (
          <Choice key={item.id} label={item.name} active={procedureId === item.id} onPress={() => chooseProcedure(item.id)} />
        ))}
      </ScrollView>

      <Text style={styles.step}>2. Profissional</Text>
      {!procedureId ? <Text style={styles.hint}>Escolha um procedimento primeiro.</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {staff.map((item) => (
          <Choice key={item.id} label={item.name} active={professionalId === item.id} onPress={() => chooseProfessional(item.id)} />
        ))}
      </ScrollView>

      <Text style={styles.step}>3. Dia preferido</Text>
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

      <Text style={styles.step}>4. Horário preferido</Text>
      {!date ? <Text style={styles.hint}>Selecione um dia para visualizar os horários.</Text> : null}
      <View style={styles.hours}>
        {slots.map((item) => (
          <Choice key={item} label={item} active={slot === item} onPress={() => setSlot(item)} />
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Suas preferências de demonstração</Text>
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
  content: { paddingHorizontal: 20, paddingTop: 23, paddingBottom: 24, gap: 12 },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heading: { color: colors.ink, fontSize: 27, fontWeight: '600', fontFamily: 'serif' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 5 },
  demoBanner: { backgroundColor: colors.blush, padding: 12, borderRadius: 8 },
  demoText: { color: colors.roseDeep, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  step: { marginTop: 14, color: colors.ink, fontSize: 14, fontWeight: '800' },
  options: { gap: 9, paddingVertical: 4 },
  choice: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 14 },
  selectedChoice: { backgroundColor: colors.roseDeep, borderColor: colors.roseDeep },
  disabledChoice: { opacity: 0.45 },
  choiceText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  selectedChoiceText: { color: '#FFFFFF' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  loading: { color: colors.roseDeep, fontSize: 12 },
  errorBox: { padding: 12, borderRadius: 9, backgroundColor: '#FFF2F0', gap: 8 },
  errorText: { color: '#912E3D', fontSize: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthLabel: { color: colors.ink, textTransform: 'capitalize', fontSize: 13, fontWeight: '700' },
  arrowButton: { width: 45, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.blush },
  arrow: { color: colors.roseDeep, fontSize: 26 },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  summary: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 13, padding: 17, gap: 6, marginTop: 12 },
  summaryTitle: { color: colors.ink, fontWeight: '800', fontSize: 14, marginBottom: 4 },
  summaryText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  action: { backgroundColor: colors.roseDeep, borderRadius: 11, padding: 17 },
  actionDisabled: { opacity: 0.45 },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
});
