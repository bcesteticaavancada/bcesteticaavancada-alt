import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { procedures, type Procedure } from './src/data/procedures';
import AgendaDemo from './src/components/AgendaDemo';
import ClientAreaDemo from './src/components/ClientAreaDemo';
import { colors, shadow } from './src/theme';

type Tab = 'inicio' | 'procedimentos' | 'agenda' | 'mensagens' | 'minha-bc';
type Filter = 'Todos' | Procedure['family'];

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Início', icon: '⌂' },
  { id: 'procedimentos', label: 'Cuidados', icon: '✧' },
  { id: 'agenda', label: 'Agenda', icon: '▦' },
  { id: 'mensagens', label: 'Contato', icon: '✉' },
  { id: 'minha-bc', label: 'Minha BC', icon: '♙' },
];

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Heading({ eyebrow, title, caption }: { eyebrow?: string; title: string; caption?: string }) {
  return (
    <View style={styles.heading}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
      <Text style={styles.headingTitle}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

function PrimaryButton({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.primaryButton, muted && styles.secondaryButton]}>
      <Text style={[styles.primaryButtonText, muted && styles.secondaryButtonText]}>{label}</Text>
      <Text style={[styles.primaryButtonText, muted && styles.secondaryButtonText]}>›</Text>
    </Pressable>
  );
}

function ProcedureCard({ item, onPress }: { item: Procedure; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.procedureCard}>
      <View style={styles.procedureIcon}><Text style={styles.procedureIconText}>{item.icon}</Text></View>
      <View style={styles.flex}>
        <Text style={styles.procedureFamily}>{item.family}</Text>
        <Text style={styles.procedureTitle}>{item.name}</Text>
        <Text style={styles.procedureCaption} numberOfLines={2}>{item.description}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('inicio');
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [filter, setFilter] = useState<Filter>('Todos');
  const [search, setSearch] = useState('');
  const [service, setService] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const visibleProcedures = useMemo(
    () => procedures.filter((item) => {
      const matchesFamily = filter === 'Todos' || filter === item.family;
      const matchesText = item.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'));
      return matchesFamily && matchesText;
    }),
    [filter, search],
  );

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setSelectedProcedure(null);
  }

  function showDemoNotice(subject: string) {
    Alert.alert(
      'Demonstração da BC',
      subject + ' ainda não está conectado à base de dados. Nenhuma reserva, mensagem ou informação clínica foi enviada.',
      [{ text: 'Entendi' }],
    );
  }

  function home() {
    return (
      <>
        <View style={styles.hero}>
          <View style={styles.heroDecor} />
          <Text style={styles.heroEyebrow}>BEAUTIFUL CENTER · BELO HORIZONTE</Text>
          <Text style={styles.heroTitle}>Sua beleza merece um cuidado único.</Text>
          <Text style={styles.heroDescription}>Uma experiência acolhedora para conhecer nossos tratamentos, organizar seus horários e acompanhar sua jornada.</Text>
          <Pressable style={styles.heroButton} accessibilityRole="button" onPress={() => changeTab('agenda')}>
            <Text style={styles.heroButtonText}>Planejar meu atendimento  ›</Text>
          </Pressable>
        </View>
        <View style={styles.content}>
          <Heading eyebrow="BC Estética Avançada" title="Bem-vinda à sua BC" caption="Cuidado, tecnologia e atenção em cada detalhe." />
          <View style={styles.highlightRow}>
            <Pressable style={styles.highlightCard} onPress={() => changeTab('procedimentos')}>
              <Text style={styles.highlightIcon}>✧</Text>
              <Text style={styles.highlightTitle}>Procedimentos</Text>
              <Text style={styles.highlightCaption}>Conheça nossos cuidados</Text>
            </Pressable>
            <Pressable style={styles.highlightCard} onPress={() => changeTab('mensagens')}>
              <Text style={styles.highlightIcon}>✉</Text>
              <Text style={styles.highlightTitle}>Fale com a BC</Text>
              <Text style={styles.highlightCaption}>Um canal próximo de você</Text>
            </Pressable>
          </View>
          <Heading eyebrow="Conheça" title="Cuidados em destaque" />
          {procedures.slice(0, 3).map((item) => (
            <ProcedureCard key={item.id} item={item} onPress={() => { setSelectedProcedure(item); setTab('procedimentos'); }} />
          ))}
          <PrimaryButton label="Explorar todos os procedimentos" muted onPress={() => changeTab('procedimentos')} />
        </View>
      </>
    );
  }

  function procedureScreen() {
    if (selectedProcedure) {
      return (
        <View style={styles.content}>
          <Pressable accessibilityRole="button" onPress={() => setSelectedProcedure(null)}>
            <Text style={styles.backLink}>‹ Voltar aos procedimentos</Text>
          </Pressable>
          <View style={styles.detailBanner}><Text style={styles.detailGlyph}>{selectedProcedure.icon}</Text></View>
          <Heading eyebrow={selectedProcedure.family} title={selectedProcedure.name} caption={selectedProcedure.description} />
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Atendimento individualizado</Text>
            <Text style={styles.bodyText}>A indicação, as contraindicações e os cuidados necessários são definidos por profissional habilitada durante a avaliação. Este aplicativo não realiza diagnóstico.</Text>
          </View>
          <PrimaryButton label="Consultar disponibilidade" onPress={() => { setService(selectedProcedure.id); changeTab('agenda'); }} />
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <Heading eyebrow="Descubra" title="Nossos procedimentos" caption="Explore as possibilidades e converse com a equipe sobre o cuidado ideal para você." />
        <TextInput
          accessibilityLabel="Buscar procedimento"
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar procedimento"
          placeholderTextColor="#9C9194"
          style={styles.input}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(['Todos', 'Facial', 'Estética avançada', 'Corporal'] as Filter[]).map((item) =>
            <Pill key={item} label={item} active={filter === item} onPress={() => setFilter(item)} />,
          )}
        </ScrollView>
        {visibleProcedures.length ? visibleProcedures.map((item) =>
          <ProcedureCard key={item.id} item={item} onPress={() => setSelectedProcedure(item)} />,
        ) : <Text style={styles.emptyText}>Nenhum procedimento encontrado.</Text>}
      </View>
    );
  }

  function scheduleScreen() {
    return <AgendaDemo requestedProcedureName={procedures.find((item) => item.id === service)?.name || null} />;
  }

  function messagesScreen() {
    return (
      <View style={styles.content}>
        <Heading eyebrow="Estamos perto" title="Converse com a BC" caption="Um espaço pensado para o contato direto com a equipe que cuida de você." />
        <View style={styles.demoBanner}><Text style={styles.demoText}>CANAL EM PREPARAÇÃO · nenhuma mensagem é enviada</Text></View>
        <View style={styles.conversationCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>BC</Text></View>
          <View style={styles.flex}>
            <Text style={styles.conversationTitle}>Equipe BC Estética</Text>
            <Text style={styles.conversationCaption}>Em breve: mensagens privadas com sua profissional</Text>
          </View>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Comunicação com privacidade</Text>
          <Text style={styles.bodyText}>Cada cliente poderá conversar com as profissionais autorizadas, receber orientações e consultar o próprio histórico. A integração segura será desenvolvida antes da liberação.</Text>
        </View>
        <Text style={styles.sectionLabel}>Experimente a futura área de mensagens</Text>
        <TextInput
          accessibilityLabel="Rascunho de mensagem local"
          multiline
          value={message}
          onChangeText={setMessage}
          placeholder="Escreva um rascunho de demonstração..."
          placeholderTextColor="#9C9194"
          style={[styles.input, styles.messageInput]}
        />
        <Text style={styles.inputHint}>Rascunho somente na tela. Não é armazenado nem transmitido.</Text>
        <PrimaryButton label="Como funcionará o envio" onPress={() => showDemoNotice('O envio de mensagens')} />
      </View>
    );
  }

  function accountScreen() {
    return <ClientAreaDemo />;
  }

  const content = {
    inicio: home,
    procedimentos: procedureScreen,
    agenda: scheduleScreen,
    mensagens: messagesScreen,
    'minha-bc': accountScreen,
  }[tab];

  return (
    <View style={styles.app}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.topBar}>
        <View><Text style={styles.brand}>BC</Text><Text style={styles.brandCaption}>ESTÉTICA AVANÇADA</Text></View>
        <View style={styles.prototypeBadge}><Text style={styles.prototypeBadgeText}>PRÉVIA V0.2</Text></View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.flex} contentContainerStyle={styles.scrollContent}>
        {content()}
      </ScrollView>
      <View style={styles.bottomNav}>
        {tabs.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.id }}
            onPress={() => changeTab(item.id)}
            style={styles.tabButton}
          >
            <Text style={[styles.tabIcon, tab === item.id && styles.tabIconActive]}>{item.icon}</Text>
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 48 },
  flex: { flex: 1 },
  topBar: { minHeight: 72, paddingHorizontal: 23, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  brand: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: colors.roseDeep, fontSize: 31, fontWeight: '700', letterSpacing: 2, lineHeight: 34 },
  brandCaption: { color: colors.gold, letterSpacing: 2.5, fontSize: 8, fontWeight: '700' },
  prototypeBadge: { paddingVertical: 7, paddingHorizontal: 11, backgroundColor: colors.blush, borderRadius: 50 },
  prototypeBadgeText: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: colors.roseDeep },
  scrollContent: { paddingBottom: 30 },
  content: { paddingHorizontal: 20, paddingTop: 23, gap: 12 },
  hero: { overflow: 'hidden', padding: 26, backgroundColor: '#ECD8D6', minHeight: 330, justifyContent: 'center' },
  heroDecor: { width: 230, height: 230, position: 'absolute', right: -80, top: -50, backgroundColor: '#F8EDE9', borderRadius: 115, opacity: 0.7 },
  heroEyebrow: { color: colors.roseDeep, fontSize: 10, letterSpacing: 1.9, fontWeight: '700', marginBottom: 16 },
  heroTitle: { maxWidth: 290, fontSize: 33, lineHeight: 40, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: colors.roseDeep, fontWeight: '700', marginBottom: 16 },
  heroDescription: { maxWidth: 305, fontSize: 14, lineHeight: 22, color: '#674C52', marginBottom: 22 },
  heroButton: { backgroundColor: colors.roseDeep, paddingHorizontal: 18, paddingVertical: 14, alignSelf: 'flex-start', borderRadius: 7 },
  heroButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  heading: { marginBottom: 9, gap: 8 },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headingTitle: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: colors.ink, fontSize: 27, lineHeight: 33, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  highlightRow: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  highlightCard: { flex: 1, backgroundColor: colors.surface, padding: 17, borderRadius: 13, minHeight: 138, ...shadow },
  highlightIcon: { fontSize: 26, color: colors.rose, marginBottom: 8 },
  highlightTitle: { color: colors.ink, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  highlightCaption: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  procedureCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.surface, padding: 14, borderRadius: 13, marginBottom: 3, borderWidth: 1, borderColor: colors.line },
  procedureIcon: { backgroundColor: colors.blush, width: 54, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  procedureIconText: { fontSize: 27, color: colors.roseDeep },
  procedureFamily: { color: colors.gold, fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '800', marginBottom: 3 },
  procedureTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  procedureCaption: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  chevron: { color: colors.rose, fontSize: 24 },
  primaryButton: { padding: 16, borderRadius: 10, backgroundColor: colors.roseDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryButton: { backgroundColor: colors.blush },
  secondaryButtonText: { color: colors.roseDeep },
  backLink: { color: colors.roseDeep, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  detailBanner: { height: 155, borderRadius: 17, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  detailGlyph: { fontSize: 86, color: colors.gold },
  infoBox: { borderRadius: 12, padding: 17, backgroundColor: '#F9F1EC', marginVertical: 10, gap: 8 },
  infoTitle: { color: colors.roseDeep, fontWeight: '800', fontSize: 14 },
  bodyText: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  input: { minHeight: 48, borderRadius: 10, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, color: colors.ink, fontSize: 14, paddingHorizontal: 14 },
  chips: { gap: 8, paddingVertical: 5, paddingRight: 12 },
  pill: { borderRadius: 40, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.roseDeep, borderColor: colors.roseDeep },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.roseDeep },
  pillTextActive: { color: '#FFFFFF' },
  sectionLabel: { color: colors.ink, fontWeight: '700', fontSize: 15, marginTop: 14 },
  demoBanner: { backgroundColor: '#F6E9DD', padding: 12, borderRadius: 9, marginBottom: 5 },
  demoText: { color: colors.warning, fontSize: 10, textAlign: 'center', letterSpacing: 0.6, fontWeight: '800' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  timeCell: { minWidth: '29%' },
  emptyText: { color: colors.muted, paddingVertical: 25, textAlign: 'center' },
  conversationCard: { backgroundColor: colors.surface, flexDirection: 'row', gap: 13, alignItems: 'center', padding: 16, borderRadius: 13, borderWidth: 1, borderColor: colors.line },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.roseDeep, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  conversationTitle: { fontSize: 15, color: colors.ink, fontWeight: '700', marginBottom: 4 },
  conversationCaption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  messageInput: { minHeight: 115, textAlignVertical: 'top', paddingTop: 14 },
  inputHint: { color: colors.muted, fontSize: 11 },
  accountCard: { alignItems: 'center', borderRadius: 16, backgroundColor: colors.blush, padding: 25, gap: 9 },
  accountAvatar: { backgroundColor: colors.surface, borderRadius: 40, width: 65, height: 65, alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { fontSize: 30, color: colors.rose },
  accountTitle: { color: colors.roseDeep, fontSize: 17, fontWeight: '700' },
  bodyTextCentered: { textAlign: 'center', color: colors.muted, fontSize: 12, lineHeight: 19 },
  accountItem: { flexDirection: 'row', gap: 12, padding: 15, backgroundColor: colors.surface, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.line },
  accountItemIcon: { fontSize: 24, color: colors.rose, width: 35, textAlign: 'center' },
  bottomNav: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 20 : 12 },
  tabButton: { flex: 1, alignItems: 'center', gap: 5 },
  tabIcon: { fontSize: 22, color: '#B5A5A7' },
  tabIconActive: { color: colors.roseDeep },
  tabText: { fontSize: 9, color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: colors.roseDeep, fontWeight: '800' },
});
