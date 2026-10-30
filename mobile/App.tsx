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

const team = [
  { name: 'Mel', role: 'Direção e estética avançada', initials: 'ML', color: '#E7C9C4' },
  { name: 'Alice', role: 'Cuidado facial e acolhimento', initials: 'AL', color: '#EBD9CB' },
  { name: 'Aline', role: 'Cuidados da pele', initials: 'AN', color: '#EDCDCE' },
  { name: 'Kátia', role: 'Massoterapia', initials: 'KT', color: '#DCC2B8' },
  { name: 'Vânia', role: 'Profissional parceira', initials: 'VN', color: '#E8D4CA' },
];

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
          <View style={styles.heroRingInner} />
          <View style={styles.heroTop}>
            <Text style={styles.heroGoldMark}>✦  BC · PRIVATE BEAUTY EXPERIENCE</Text>
            <Text style={styles.heroLocation}>BELO HORIZONTE · MG</Text>
          </View>
          <View style={styles.heroBody}>
            <View style={styles.heroEyebrowFrame}><View style={styles.heroEyebrowDot} /><Text style={styles.heroEyebrow}>ESTÉTICA AVANÇADA COM PERSONALIDADE</Text></View>
            <Text style={styles.heroTitle}>A sua beleza merece ser celebrada.</Text>
            <View style={styles.heroRoseLine} />
            <Text style={styles.heroDescription}>Tecnologia, acolhimento e experiências que valorizam o seu cuidado.</Text>
            <Pressable style={styles.heroButton} accessibilityRole="button" onPress={() => changeTab('agenda')}>
              <Text style={styles.heroButtonText}>Explorar a agenda  ↗</Text>
            </Pressable>
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>BC · ESTÉTICA AVANÇADA</Text>
            <Text style={styles.heroFooterText}>✧  ✧  ✧</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.welcomeBlock}>
            <Text style={styles.welcomeEyebrow}>BEM-VINDA À BC</Text>
            <Text style={styles.welcomeTitle}>Cada detalhe foi pensado para você.</Text>
            <Text style={styles.welcomeText}>Conheça nossos procedimentos, encontre sua profissional e acompanhe a experiência BC em um só aplicativo.</Text>
          </View>

          <View style={styles.signatureRibbon}>
            <View style={styles.signatureMonogram}><Text style={styles.signatureMonogramText}>✧</Text></View>
            <View style={styles.signatureCopy}>
              <Text style={styles.signatureEyebrow}>A ESSÊNCIA DA BC</Text>
              <Text style={styles.signatureTitle}>Elegância em cada detalhe.</Text>
              <Text style={styles.signatureCaption}>Ambientes acolhedores · atenção individualizada</Text>
            </View>
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
                <View style={styles.featureCardHalo} />
                <Text style={styles.featureNumber}>0{index + 1} / {item.family.toUpperCase()}</Text>
                <View style={styles.featureIconFrame}><Text style={styles.featureIcon}>{item.icon}</Text></View>
                <View style={styles.featureThinLine} />
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

          <View style={styles.sectionHead}>
            <View style={styles.goldLine} />
            <Heading eyebrow="Gente que acolhe" title="Quem faz a experiência BC" caption="Conheça os nomes por trás do cuidado e da recepção da clínica." />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamRow}>
            {team.map((person) => (
              <Pressable key={person.name} accessibilityRole="button" onPress={() => changeTab('mensagens')} style={styles.teamCard}>
                <View style={[styles.teamPortrait, { backgroundColor: person.color }]}>
                  <View style={styles.teamPortraitInner}><Text style={styles.teamInitials}>{person.initials}</Text></View>
                </View>
                <Text style={styles.teamName}>{person.name}</Text>
                <Text style={styles.teamRole}>{person.role}</Text>
                <View style={styles.teamFooter}><Text style={styles.teamFooterText}>EQUIPE BC  ✧</Text></View>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.teamFootnote}>Apresentação institucional. Atendimentos e permissões profissionais são confirmados diretamente pela clínica.</Text>

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
          <View style={styles.previewCard}>
            <Text style={styles.previewStar}>✧</Text>
            <Text style={styles.previewDisclaimer}>PRÉVIA V0.4 · Este app funciona com dados ilustrativos. Nenhum atendimento, mensagem ou documento real é consultado ou enviado.</Text>
          </View>
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
          <View style={styles.detailBanner}>
            <View style={styles.detailDeco} />
            <Text style={styles.detailEyebrow}>BC · UM CUIDADO PARA VOCÊ</Text>
            <Text style={styles.detailGlyph}>{selectedProcedure.icon}</Text>
            <Text style={styles.detailFooter}>✧  EXPERIÊNCIA PERSONALIZADA  ✧</Text>
          </View>
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
        <View style={styles.catalogHero}>
          <View style={styles.catalogHalo} />
          <Text style={styles.catalogGold}>CATÁLOGO BC  /  ESTÉTICA AVANÇADA</Text>
          <Text style={styles.catalogTitle}>Rituais de beleza e cuidado.</Text>
          <Text style={styles.catalogIntro}>Explore as possibilidades e converse com a equipe sobre o atendimento indicado para você.</Text>
          <Text style={styles.catalogCount}>{procedures.length} PROCEDIMENTOS EM DESTAQUE  ✧</Text>
        </View>
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
        <View style={styles.contactHero}>
          <Text style={styles.contactEyebrow}>BC · CONCIERGE DE CUIDADO</Text>
          <Text style={styles.contactTitle}>Sempre perto de você.</Text>
          <View style={styles.contactSeparator} />
          <Text style={styles.contactCaption}>Estamos preparando um espaço reservado para conversar com as profissionais e acompanhar seu cuidado, com privacidade.</Text>
          <Text style={styles.contactSignature}>COM CARINHO, EQUIPE BC  ✧</Text>
        </View>
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
        <View style={styles.contactBenefits}>
          <Text style={styles.contactBenefitsTitle}>O que você encontrará aqui</Text>
          <Text style={styles.contactBenefit}>✧  Canal exclusivo com sua profissional</Text>
          <Text style={styles.contactBenefit}>✧  Orientações vinculadas aos seus atendimentos</Text>
          <Text style={styles.contactBenefit}>✧  Histórico protegido por acesso individual</Text>
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
          <View style={styles.brandSeal}><Image source={require('./assets/logo-oficial.png')} style={styles.brandImage} resizeMode="contain" accessibilityLabel="Identidade visual BC Estética Avançada" /></View>
          <View style={styles.brandWords}>
            <Text style={styles.brandCaption}>BC ESTÉTICA</Text>
            <Text style={styles.brandSubtitle}>AVANÇADA</Text>
          </View>
        </View>
        <View style={styles.prototypeBadge}><Text style={styles.prototypeBadgeText}>V0.4  ✧  PRÉVIA</Text></View>
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
  brandSeal: { width: 64, height: 64, padding: 4, borderRadius: 18, backgroundColor: '#FFFDFB', borderWidth: 1.5, borderColor: '#C89D88', alignItems: 'center', justifyContent: 'center', shadowColor: '#9D6370', shadowOpacity: 0.14, shadowRadius: 7, elevation: 2 },
  heroRingInner: { position: 'absolute', width: 138, height: 138, borderWidth: 1, borderColor: 'rgba(255,224,208,0.25)', borderRadius: 69, right: -62, top: 117 },
  heroEyebrowFrame: { flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 15 },
  heroEyebrowDot: { backgroundColor: '#D4A88C', width: 20, height: 1.5 },
  heroRoseLine: { width: 72, height: 2, backgroundColor: '#D7A98D', marginBottom: 16 },
  signatureRibbon: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6E7E2', borderRadius: 15, borderWidth: 1, borderColor: '#E8C8BC', padding: 14, gap: 13, marginBottom: 17, overflow: 'hidden' },
  signatureMonogram: { height: 62, width: 62, borderRadius: 35, borderWidth: 1.5, borderColor: '#C89382', backgroundColor: '#FFF8F2', alignItems: 'center', justifyContent: 'center' },
  signatureMonogramText: { color: '#BC8876', fontSize: 37 },
  signatureCopy: { flex: 1, gap: 5 },
  signatureEyebrow: { fontSize: 8, letterSpacing: 2.0, fontWeight: '800', color: '#AB7768' },
  signatureTitle: { fontSize: 17, color: '#5A3442', fontFamily: 'serif', fontWeight: '700' },
  signatureCaption: { fontSize: 10, lineHeight: 15, color: '#866E70' },
  featureCardHalo: { position: 'absolute', top: -50, right: -54, height: 125, width: 125, borderRadius: 65, borderWidth: 1, borderColor: '#E4BBAE', backgroundColor: 'rgba(238,202,191,0.20)' },
  featureThinLine: { height: 1, width: 45, backgroundColor: '#C8927C' },
  teamRow: { gap: 12, paddingVertical: 7, paddingRight: 20 },
  teamCard: { width: 152, borderWidth: 1, borderColor: '#E8D5CD', borderRadius: 17, padding: 12, backgroundColor: '#FFFDFC', alignItems: 'center', overflow: 'hidden', minHeight: 213 },
  teamPortrait: { height: 96, width: 96, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  teamPortraitInner: { height: 81, width: 81, borderRadius: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDF5F1' },
  teamInitials: { color: '#774353', fontSize: 25, fontFamily: 'serif', fontWeight: '700', letterSpacing: 2 },
  teamName: { color: '#593542', fontSize: 16, fontWeight: '800' },
  teamRole: { fontSize: 10, color: '#876F73', lineHeight: 15, textAlign: 'center', marginTop: 4, minHeight: 30 },
  teamFooter: { borderTopWidth: 1, borderColor: '#ECD6CE', alignSelf: 'stretch', marginTop: 'auto', paddingTop: 9 },
  teamFooterText: { color: '#B3836F', fontSize: 9, letterSpacing: 1.1, textAlign: 'center' },
  teamFootnote: { fontSize: 10, color: '#9B7E81', lineHeight: 16, marginTop: -3 },
  previewCard: { borderWidth: 1, borderColor: '#E9D0C8', backgroundColor: '#FAEEEA', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
  previewStar: { fontSize: 22, color: '#B77D70' },
  catalogHero: { minHeight: 223, backgroundColor: '#593444', borderRadius: 21, padding: 23, gap: 12, overflow: 'hidden', marginBottom: 8 },
  catalogHalo: { position: 'absolute', width: 250, height: 250, borderRadius: 125, borderWidth: 1, borderColor: 'rgba(235,184,164,0.28)', right: -120, top: -40 },
  catalogGold: { color: '#E9BF9E', fontSize: 9, letterSpacing: 1.5, fontWeight: '800' },
  catalogTitle: { color: '#FFF7F2', fontFamily: 'serif', fontSize: 32, lineHeight: 37, maxWidth: 265 },
  catalogIntro: { color: '#F3E1E0', fontSize: 12, lineHeight: 19, maxWidth: 285 },
  catalogCount: { color: '#E4BFA8', fontSize: 9, letterSpacing: 1.3, fontWeight: '700', marginTop: 3 },
  detailDeco: { position: 'absolute', height: 170, width: 170, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(227,178,156,0.33)', right: -35, top: -25 },
  detailEyebrow: { color: '#E9BF9E', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 10 },
  detailFooter: { fontSize: 9, color: '#E9BF9E', letterSpacing: 1.5, marginBottom: 8 },
  contactHero: { backgroundColor: '#563445', borderRadius: 21, padding: 23, gap: 13, overflow: 'hidden' },
  contactEyebrow: { color: '#E5BBA2', fontSize: 10, letterSpacing: 1.6, fontWeight: '800' },
  contactTitle: { color: '#FFF5F1', fontSize: 32, fontFamily: 'serif', lineHeight: 38 },
  contactSeparator: { width: 54, height: 2, backgroundColor: '#D8A58F' },
  contactCaption: { color: '#F3E3E2', fontSize: 13, lineHeight: 21 },
  contactSignature: { color: '#EAC3AF', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 7 },
  contactBenefits: { borderWidth: 1, borderColor: '#EBD2C7', borderRadius: 15, backgroundColor: '#F8EDE9', padding: 17, gap: 12 },
  contactBenefitsTitle: { fontFamily: 'serif', fontSize: 19, color: '#613C48', fontWeight: '700' },
  contactBenefit: { fontSize: 12, color: '#7E6269', lineHeight: 17 },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  brandImage: { width: 55, height: 55, borderRadius: 15, backgroundColor: '#FFFFFF' },
  brandWords: { gap: 3 },
  brandSubtitle: { color: colors.roseDeep, fontSize: 10, letterSpacing: 2.1, fontWeight: '800' },
  heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heroTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(55,30,41,0.69)' },
  heroRing: { position: 'absolute', width: 250, height: 250, borderWidth: 1, borderColor: 'rgba(229,176,151,0.50)', borderRadius: 125, right: -116, top: 76 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  heroGoldMark: { color: '#E7BAA2', fontSize: 9, letterSpacing: 1.1, fontWeight: '800', flexShrink: 1 },
  heroLocation: { color: '#F7E7E2', fontSize: 8, letterSpacing: 1.0 },
  heroBody: { paddingTop: 43, paddingBottom: 28, zIndex: 1 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopColor: 'rgba(255,255,255,0.23)', borderTopWidth: 1, paddingTop: 12, zIndex: 1 },
  heroFooterText: { color: '#F3CFBC', fontSize: 9, fontWeight: '700', letterSpacing: 1.7 },
  welcomeBlock: { marginVertical: 15, gap: 11 },
  welcomeEyebrow: { color: colors.gold, letterSpacing: 2.3, fontWeight: '800', fontSize: 10 },
  welcomeTitle: { color: colors.ink, fontFamily: 'serif', fontWeight: '600', fontSize: 29, lineHeight: 36 },
  welcomeText: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  highlightCardAccent: { backgroundColor: '#F2D9D1', borderWidth: 1, borderColor: '#DCAEA2' },
  highlightArrow: { color: colors.gold, fontWeight: '800', fontSize: 17, alignSelf: 'flex-end', marginTop: 8 },
  sectionHead: { marginTop: 19, gap: 13 },
  goldLine: { height: 3, width: 55, backgroundColor: '#C4927C', borderRadius: 3 },
  featureRow: { gap: 12, paddingVertical: 4, paddingRight: 20 },
  featureCard: { width: 212, minHeight: 264, borderRadius: 19, borderWidth: 1, borderColor: '#E7CFC6', padding: 17, backgroundColor: '#FFFFFF', gap: 9, overflow: 'hidden' },
  featureCardBlush: { backgroundColor: '#F8E7E2' },
  featureNumber: { fontSize: 9, color: colors.gold, letterSpacing: 0.8, fontWeight: '800', height: 24 },
  featureIconFrame: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFAF8', borderWidth: 1.5, borderColor: '#D8A990', marginBottom: 4 },
  featureIcon: { fontSize: 29, color: colors.roseDeep },
  featureTitle: { fontSize: 18, fontFamily: 'serif', color: colors.ink, fontWeight: '700' },
  featureCaption: { fontSize: 11, lineHeight: 17, color: colors.muted, minHeight: 47 },
  featureAction: { fontSize: 10, fontWeight: '800', color: colors.roseDeep, letterSpacing: 1, marginTop: 'auto' },
  spaceRow: { gap: 12, paddingRight: 20, paddingVertical: 5 },
  spaceCard: { backgroundColor: colors.surface, borderRadius: 19, overflow: 'hidden', width: 244, borderWidth: 1, borderColor: '#DEC3B8' },
  spacePhoto: { width: '100%', height: 163 },
  spaceInfo: { padding: 14, gap: 6 },
  spaceName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  spaceCaption: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  journeyBox: { backgroundColor: '#543444', padding: 23, marginTop: 22, borderRadius: 22, gap: 12, borderWidth: 1, borderColor: '#9A6573' },
  journeyEyebrow: { color: '#D5B98D', fontSize: 10, letterSpacing: 2.0, fontWeight: '800' },
  journeyTitle: { color: '#FFF7F0', fontFamily: 'serif', fontSize: 26, lineHeight: 33 },
  journeyStep: { flexDirection: 'row', gap: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)', paddingTop: 13 },
  journeyNum: { color: '#D7B989', fontSize: 20, fontFamily: 'serif', width: 31 },
  journeyStepTitle: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginBottom: 5 },
  journeyStepText: { fontSize: 11, lineHeight: 17, color: '#E7D9DC' },
  journeyButton: { backgroundColor: '#D8B78C', padding: 15, marginTop: 5, borderRadius: 9 },
  journeyButtonText: { color: '#39242D', textAlign: 'center', fontWeight: '800', fontSize: 12 },
  previewDisclaimer: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 17 },
  navIconWrap: { width: 46, height: 32, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#F1D9D0', borderColor: '#D9AA97', borderWidth: 1 },

  app: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 48 },
  flex: { flex: 1 },
  topBar: { minHeight: 84, paddingHorizontal: 12, backgroundColor: '#FFF8F4', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#E5BBAA' },
  brand: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: colors.roseDeep, fontSize: 31, fontWeight: '700', letterSpacing: 2, lineHeight: 34 },
  brandCaption: { color: colors.gold, letterSpacing: 1.8, fontSize: 9, fontWeight: '800' },
  prototypeBadge: { paddingVertical: 9, paddingHorizontal: 10, backgroundColor: '#F2DAD1', borderColor: '#D6AD9A', borderWidth: 1, borderRadius: 50 },
  prototypeBadgeText: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: colors.roseDeep },
  scrollContent: { paddingBottom: 30 },
  content: { paddingHorizontal: 20, paddingTop: 23, gap: 12 },
  hero: { overflow: 'hidden', padding: 23, backgroundColor: '#3A2832', minHeight: 442, justifyContent: 'space-between', borderBottomWidth: 4, borderBottomColor: '#C99780' },
  heroDecor: { width: 230, height: 230, position: 'absolute', right: -80, top: -50, backgroundColor: '#F8EDE9', borderRadius: 115, opacity: 0.7 },
  heroEyebrow: { color: '#E8C6B4', fontSize: 9, letterSpacing: 1.1, fontWeight: '800' },
  heroTitle: { maxWidth: 320, fontSize: 36, lineHeight: 42, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: '#FFFAF6', fontWeight: '700', marginBottom: 15 },
  heroDescription: { maxWidth: 300, fontSize: 14, lineHeight: 22, color: '#F5E8E5', marginBottom: 22 },
  heroButton: { backgroundColor: '#E4B79F', paddingHorizontal: 21, paddingVertical: 15, alignSelf: 'flex-start', borderRadius: 25, borderWidth: 1, borderColor: '#FFDBBF' },
  heroButtonText: { color: '#492D38', fontWeight: '800', fontSize: 13 },
  heading: { marginBottom: 9, gap: 8 },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headingTitle: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: colors.ink, fontSize: 27, lineHeight: 33, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  highlightRow: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  highlightCard: { flex: 1, backgroundColor: '#FFFDFC', padding: 18, borderRadius: 17, minHeight: 146, borderColor: '#E8CEC3', borderWidth: 1, ...shadow },
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
  detailBanner: { height: 205, borderRadius: 20, backgroundColor: '#563745', alignItems: 'center', justifyContent: 'space-around', overflow: 'hidden', marginBottom: 15 },
  detailGlyph: { fontSize: 86, color: '#E5B49C' },
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
  bottomNav: { flexDirection: 'row', backgroundColor: '#FFF8F4', borderTopWidth: 2, borderTopColor: '#E4B9A7', paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 12 },
  tabButton: { flex: 1, alignItems: 'center', gap: 5 },
  tabIcon: { fontSize: 22, color: '#B5A5A7' },
  tabIconActive: { color: colors.roseDeep },
  tabText: { fontSize: 9, color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: colors.roseDeep, fontWeight: '800' },
});
