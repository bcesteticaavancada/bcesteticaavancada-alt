import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
  { id: 'minha-bc', label: 'Minha BC', icon: '♡' },
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
    const spaces = [
      { name: 'Sala de Estética Avançada', caption: 'Tecnologia e cuidado individualizado', image: require('./assets/sala-procedimentos.jpg') },
      { name: 'Sala de Estética Facial', caption: 'Um ambiente pensado para você', image: require('./assets/sala-atendimento.jpg') },
      { name: 'Sala de Massagem', caption: 'Conforto e acolhimento', image: require('./assets/sala-massagem.jpg') },
    ];

    return (
      <>
        <View style={styles.hero}>
          <Image source={require('./assets/recepcao.jpg')} resizeMode="cover" style={styles.heroImage} accessibilityLabel="Ambiente da BC Estética Avançada" />
          <View style={styles.heroTint} />
          <View style={styles.heroRing} />
          <View style={styles.heroTop}>
            <Text style={styles.heroGoldMark}>✦  BEAUTIFUL CENTER</Text>
            <Text style={styles.heroLocation}>BELO HORIZONTE · MG</Text>
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroEyebrow}>ESTÉTICA AVANÇADA COM PERSONALIDADE</Text>
            <Text style={styles.heroTitle}>Sua beleza, nossa essência.</Text>
            <Text style={styles.heroDescription}>Tecnologia, acolhimento e experiências que valorizam o seu cuidado.</Text>
            <Pressable style={styles.heroButton} accessibilityRole="button" onPress={() => changeTab('agenda')}>
              <Text style={styles.heroButtonText}>Explorar a agenda  ↗</Text>
            </Pressable>
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>BC SIGNATURE EXPERIENCE</Text>
            <Text style={styles.heroFooterText}>✧  ✧  ✧</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.welcomeBlock}>
            <Text style={styles.welcomeEyebrow}>BEM-VINDA À BC</Text>
            <Text style={styles.welcomeTitle}>Cada detalhe foi pensado para você.</Text>
            <Text style={styles.welcomeText}>Conheça nossos procedimentos, encontre sua profissional e acompanhe a experiência BC em um só aplicativo.</Text>
          </View>

          <View style={styles.highlightRow}>
            <Pressable accessibilityRole="button" style={[styles.highlightCard, styles.highlightCardAccent]} onPress={() => changeTab('agenda')}>
              <Text style={styles.highlightIcon}>▦</Text>
              <Text style={styles.highlightTitle}>Agendar</Text>
              <Text style={styles.highlightCaption}>Organize seu próximo cuidado</Text>
              <Text style={styles.highlightArrow}>↗</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.highlightCard} onPress={() => changeTab('minha-bc')}>
              <Text style={styles.highlightIcon}>♡</Text>
              <Text style={styles.highlightTitle}>Minha BC</Text>
              <Text style={styles.highlightCaption}>Sua jornada em um só lugar</Text>
              <Text style={styles.highlightArrow}>↗</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.goldLine} />
            <Heading eyebrow="Descubra" title="Cuidados em destaque" caption="Conheça os tratamentos e tire suas dúvidas com nossa equipe." />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featureRow}>
            {procedures.slice(0, 5).map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                style={[styles.featureCard, index % 2 === 0 && styles.featureCardBlush]}
                onPress={() => { setSelectedProcedure(item); setTab('procedimentos'); }}
              >
                <Text style={styles.featureNumber}>0{index + 1} · {item.family.toUpperCase()}</Text>
                <View style={styles.featureIconFrame}><Text style={styles.featureIcon}>{item.icon}</Text></View>
                <Text style={styles.featureTitle}>{item.name}</Text>
                <Text style={styles.featureCaption} numberOfLines={3}>{item.description}</Text>
                <Text style={styles.featureAction}>CONHECER  ↗</Text>
              </Pressable>
            ))}
          </ScrollView>
          <PrimaryButton label="Ver catálogo completo" muted onPress={() => changeTab('procedimentos')} />

          <View style={styles.sectionHead}>
            <View style={styles.goldLine} />
            <Heading eyebrow="Um espaço especial" title="Conheça nossos ambientes" caption="Um olhar por dentro da clínica BC Estética Avançada." />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spaceRow}>
            {spaces.map((space) => (
              <View key={space.name} style={styles.spaceCard}>
                <Image source={space.image} style={styles.spacePhoto} resizeMode="cover" accessibilityLabel={space.name} />
                <View style={styles.spaceInfo}>
                  <Text style={styles.spaceName}>{space.name}</Text>
                  <Text style={styles.spaceCaption}>{space.caption}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.journeyBox}>
            <Text style={styles.journeyEyebrow}>A EXPERIÊNCIA BC</Text>
            <Text style={styles.journeyTitle}>Seu cuidado, no seu tempo.</Text>
            <View style={styles.journeyStep}>
              <Text style={styles.journeyNum}>01</Text>
              <View style={styles.flex}><Text style={styles.journeyStepTitle}>Conheça</Text><Text style={styles.journeyStepText}>Explore nossos procedimentos e ambientes.</Text></View>
            </View>
            <View style={styles.journeyStep}>
              <Text style={styles.journeyNum}>02</Text>
              <View style={styles.flex}><Text style={styles.journeyStepTitle}>Converse</Text><Text style={styles.journeyStepText}>Encontre orientação com uma profissional habilitada.</Text></View>
            </View>
            <View style={styles.journeyStep}>
              <Text style={styles.journeyNum}>03</Text>
              <View style={styles.flex}><Text style={styles.journeyStepTitle}>Acompanhe</Text><Text style={styles.journeyStepText}>No futuro, consulte sua jornada com acesso protegido.</Text></View>
            </View>
            <Pressable accessibilityRole="button" style={styles.journeyButton} onPress={() => changeTab('mensagens')}>
              <Text style={styles.journeyButtonText}>Conheça o canal de contato  ›</Text>
            </Pressable>
          </View>
          <Text style={styles.previewDisclaimer}>PRÉVIA V0.3 · As áreas de agenda e cliente usam somente dados fictícios. Nenhum atendimento é agendado por esta versão.</Text>
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
        <View style={styles.brandBlock}>
          <Image source={require('./assets/logo-oficial.png')} style={styles.brandImage} resizeMode="contain" accessibilityLabel="Logo oficial BC Estética Avançada" />
          <View style={styles.brandWords}>
            <Text style={styles.brandCaption}>BC ESTÉTICA</Text>
            <Text style={styles.brandSubtitle}>AVANÇADA</Text>
          </View>
        </View>
        <View style={styles.prototypeBadge}><Text style={styles.prototypeBadgeText}>PRÉVIA V0.3</Text></View>
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
            <View style={[styles.navIconWrap, tab === item.id && styles.navIconWrapActive]}><Text style={[styles.tabIcon, tab === item.id && styles.tabIconActive]}>{item.icon}</Text></View>
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  brandImage: { width: 58, height: 58, borderRadius: 10, backgroundColor: '#FFFFFF' },
  brandWords: { gap: 3 },
  brandSubtitle: { color: colors.roseDeep, fontSize: 10, letterSpacing: 2.1, fontWeight: '800' },
  heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heroTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(33,20,26,0.65)' },
  heroRing: { position: 'absolute', width: 210, height: 210, borderWidth: 1, borderColor: 'rgba(225,189,143,0.38)', borderRadius: 105, right: -95, top: 82 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  heroGoldMark: { color: '#F7DAB1', fontSize: 10, letterSpacing: 2.0, fontWeight: '800' },
  heroLocation: { color: '#F7E7E2', fontSize: 8, letterSpacing: 1.0 },
  heroBody: { paddingTop: 62, paddingBottom: 35, zIndex: 1 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopColor: 'rgba(255,255,255,0.23)', borderTopWidth: 1, paddingTop: 12, zIndex: 1 },
  heroFooterText: { color: '#F5D3BB', fontSize: 9, fontWeight: '700', letterSpacing: 1.9 },
  welcomeBlock: { marginVertical: 11, gap: 11 },
  welcomeEyebrow: { color: colors.gold, letterSpacing: 2.3, fontWeight: '800', fontSize: 10 },
  welcomeTitle: { color: colors.ink, fontFamily: 'serif', fontWeight: '600', fontSize: 29, lineHeight: 36 },
  welcomeText: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  highlightCardAccent: { backgroundColor: '#F5E4DD', borderWidth: 1, borderColor: '#E9CEC1' },
  highlightArrow: { color: colors.gold, fontWeight: '800', fontSize: 17, alignSelf: 'flex-end', marginTop: 8 },
  sectionHead: { marginTop: 19, gap: 13 },
  goldLine: { height: 2, width: 48, backgroundColor: colors.gold, borderRadius: 2 },
  featureRow: { gap: 12, paddingVertical: 4, paddingRight: 20 },
  featureCard: { width: 205, minHeight: 257, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 16, backgroundColor: '#FFFFFF', gap: 9 },
  featureCardBlush: { backgroundColor: '#FAF0EC' },
  featureNumber: { fontSize: 9, color: colors.gold, letterSpacing: 0.8, fontWeight: '800', height: 24 },
  featureIconFrame: { width: 55, height: 55, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EADBD3', marginBottom: 4 },
  featureIcon: { fontSize: 29, color: colors.roseDeep },
  featureTitle: { fontSize: 18, fontFamily: 'serif', color: colors.ink, fontWeight: '700' },
  featureCaption: { fontSize: 11, lineHeight: 17, color: colors.muted, minHeight: 47 },
  featureAction: { fontSize: 10, fontWeight: '800', color: colors.roseDeep, letterSpacing: 1, marginTop: 'auto' },
  spaceRow: { gap: 12, paddingRight: 20, paddingVertical: 5 },
  spaceCard: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', width: 240, borderWidth: 1, borderColor: colors.line },
  spacePhoto: { width: '100%', height: 146 },
  spaceInfo: { padding: 14, gap: 6 },
  spaceName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  spaceCaption: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  journeyBox: { backgroundColor: '#3A2530', padding: 21, marginTop: 20, borderRadius: 17, gap: 12 },
  journeyEyebrow: { color: '#D5B98D', fontSize: 10, letterSpacing: 2.0, fontWeight: '800' },
  journeyTitle: { color: '#FFF7F0', fontFamily: 'serif', fontSize: 26, lineHeight: 33 },
  journeyStep: { flexDirection: 'row', gap: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)', paddingTop: 13 },
  journeyNum: { color: '#D7B989', fontSize: 20, fontFamily: 'serif', width: 31 },
  journeyStepTitle: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginBottom: 5 },
  journeyStepText: { fontSize: 11, lineHeight: 17, color: '#E7D9DC' },
  journeyButton: { backgroundColor: '#D8B78C', padding: 15, marginTop: 5, borderRadius: 9 },
  journeyButtonText: { color: '#39242D', textAlign: 'center', fontWeight: '800', fontSize: 12 },
  previewDisclaimer: { color: colors.muted, fontSize: 10, lineHeight: 17, paddingVertical: 12 },
  navIconWrap: { width: 46, height: 32, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#F2E4E1' },

  app: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 48 },
  flex: { flex: 1 },
  topBar: { minHeight: 78, paddingHorizontal: 16, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  brand: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: colors.roseDeep, fontSize: 31, fontWeight: '700', letterSpacing: 2, lineHeight: 34 },
  brandCaption: { color: colors.gold, letterSpacing: 1.8, fontSize: 9, fontWeight: '800' },
  prototypeBadge: { paddingVertical: 7, paddingHorizontal: 11, backgroundColor: colors.blush, borderRadius: 50 },
  prototypeBadgeText: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: colors.roseDeep },
  scrollContent: { paddingBottom: 30 },
  content: { paddingHorizontal: 20, paddingTop: 23, gap: 12 },
  hero: { overflow: 'hidden', padding: 23, backgroundColor: '#3A2832', minHeight: 398, justifyContent: 'space-between' },
  heroDecor: { width: 230, height: 230, position: 'absolute', right: -80, top: -50, backgroundColor: '#F8EDE9', borderRadius: 115, opacity: 0.7 },
  heroEyebrow: { color: '#E6C49B', fontSize: 10, letterSpacing: 1.9, fontWeight: '800', marginBottom: 14 },
  heroTitle: { maxWidth: 320, fontSize: 37, lineHeight: 44, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: '#FFFFFF', fontWeight: '700', marginBottom: 15 },
  heroDescription: { maxWidth: 300, fontSize: 14, lineHeight: 22, color: '#F5E8E5', marginBottom: 22 },
  heroButton: { backgroundColor: '#D9B887', paddingHorizontal: 20, paddingVertical: 15, alignSelf: 'flex-start', borderRadius: 7 },
  heroButtonText: { color: '#382730', fontWeight: '800', fontSize: 13 },
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
