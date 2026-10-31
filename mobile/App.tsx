import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
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
import { colors } from './src/theme';

type Tab = 'inicio' | 'procedimentos' | 'agenda' | 'minha-bc';
type Filter = 'Todos' | Procedure['family'];

const team = [
  { name: 'Mel', role: 'Direção e estética avançada', image: require('./assets/team-mel.jpg'), isGroup: false },
  { name: 'Alice', role: 'Cuidados faciais e acolhimento', image: require('./assets/team-alice.webp'), isGroup: false },
  { name: 'Aline', role: 'Cuidados da pele', image: require('./assets/team-aline.webp'), isGroup: false },
  { name: 'Kátia', role: 'Massoterapia', image: require('./assets/team-katia.webp'), isGroup: false },
  { name: 'Vânia', role: 'Profissional parceira', image: require('./assets/team-group.webp'), isGroup: true },
];

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Início', icon: '⌂' },
  { id: 'procedimentos', label: 'Cuidados', icon: '✧' },
  { id: 'agenda', label: 'Agenda', icon: '▦' },
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

function ProcedureCard({ item, index, onPress }: { item: Procedure; index: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.procedureCard}>
      <Text style={styles.procedureIndex}>{String(index + 1).padStart(2, '0')}</Text>
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
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const visibleProcedures = useMemo(
    () => procedures.filter((item) => {
      const matchesFamily = filter === 'Todos' || filter === item.family;
      const matchesText = item.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'));
      return matchesFamily && matchesText && (!showSavedOnly || savedIds.includes(item.id));
    }),
    [filter, search, savedIds, showSavedOnly],
  );

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setSelectedProcedure(null);
    setPrivacyOpen(false);
  }

  function toggleSavedProcedure(id: string) {
    setSavedIds((current) =>
      current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id],
    );
  }

  // The physical Android Back button follows the app's own navigation first.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (privacyOpen) {
        setPrivacyOpen(false);
        return true;
      }
      if (selectedProcedure && tab === 'procedimentos') {
        setSelectedProcedure(null);
        return true;
      }
      if (tab !== 'inicio') {
        changeTab('inicio');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [privacyOpen, selectedProcedure, tab]);

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
        <View style={styles.homeHero}>
          <Image
            source={require('./assets/sala-atendimento.jpg')}
            resizeMode="cover"
            style={styles.homeHeroPhoto}
            accessibilityLabel="Sala de estética facial da BC Estética Avançada"
          />
          <View style={styles.homeHeroTint} />
          <View style={styles.homeHeroInner}>
            <Text style={styles.homeOverline}>BEAUTY CENTER · ESTÉTICA AVANÇADA</Text>
            <Text style={styles.homeHeadline}>Beleza com propósito.</Text>
            <Text style={styles.homeSubline}>Ciência e estética para uma beleza real, natural e que acompanha a sua história.</Text>
            <Pressable accessibilityRole="button" style={styles.homeMainButton} onPress={() => changeTab('agenda')}>
              <Text style={styles.homeMainButtonText}>Agende sua avaliação  ›</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.homeContent}>
          <View style={styles.homeQuickRow}>
            <Pressable accessibilityRole="button" onPress={() => changeTab('minha-bc')} style={styles.homeQuickPrimary}>
              <Text style={styles.homeQuickIcon}>♡</Text>
              <Text style={styles.homeQuickTitlePrimary}>Minha BC</Text>
              <Text style={styles.homeQuickCaptionPrimary}>Seu pós-atendimento</Text>
              <Text style={styles.homeQuickArrowPrimary}>↗</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => changeTab('procedimentos')} style={styles.homeQuickSecondary}>
              <Text style={styles.homeQuickIconSecondary}>✧</Text>
              <Text style={styles.homeQuickTitleSecondary}>Cuidados</Text>
              <Text style={styles.homeQuickCaptionSecondary}>Conheça a BC</Text>
              <Text style={styles.homeQuickArrowSecondary}>↗</Text>
            </Pressable>
          </View>
          <View style={styles.homeClinicCard}>
            <Image source={require('./assets/sala-procedimentos.jpg')} resizeMode="cover" style={styles.homeClinicPhoto} accessibilityLabel="Sala de Estética Avançada" />
            <View style={styles.homeClinicTint} />
            <View style={styles.homeClinicCaption}>
              <Text style={styles.homeClinicKicker}>A CLÍNICA</Text>
              <Text style={styles.homeClinicTitle}>Um espaço pensado para você.</Text>
            </View>
          </View>
          <View style={styles.homeTeamHeading}>
            <Text style={styles.homeTeamOverline}>O TOQUE HUMANO DA BC</Text>
            <Text style={styles.homeTeamTitle}>Quem cuida de você</Text>
          </View>
          <View style={styles.homeTeamImageWrap}>
            <Image
              source={require('./assets/team-group.webp')}
              resizeMode="cover"
              style={styles.homeTeamImage}
              accessibilityLabel="Equipe institucional da BC Estética Avançada"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.homePortraitRow}>
            {team.map((person) => (
              <View key={person.name} style={styles.homePortraitCard}>
                <Image
                  source={person.image}
                  resizeMode="cover"
                  style={styles.homePortraitImage}
                  accessibilityLabel={person.isGroup ? 'Vânia representada na foto institucional coletiva' : 'Retrato institucional de ' + person.name}
                />
                <Text style={styles.homePortraitName}>{person.name}</Text>
                <Text style={styles.homePortraitRole} numberOfLines={2}>{person.role}</Text>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.homePreviewNote}>PRÉVIA INTERNA · Atendimento e mensagens ainda não conectados.</Text>
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
            <Image source={require('./assets/sala-atendimento.jpg')} resizeMode="cover" style={styles.detailPhoto} accessibilityLabel="Ambiente de atendimento da BC" />
            <View style={styles.detailPhotoTint} />
            <Text style={styles.detailEyebrow}>BC · CUIDADO INDIVIDUAL</Text>
            <Text style={styles.detailHeroTitle}>Um cuidado para você.</Text>
          </View>
          <Heading eyebrow={selectedProcedure.family} title={selectedProcedure.name} caption={selectedProcedure.description} />
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Atendimento individualizado</Text>
            <Text style={styles.bodyText}>A indicação, as contraindicações e os cuidados necessários são definidos por profissional habilitada durante a avaliação. Este aplicativo não realiza diagnóstico.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: savedIds.includes(selectedProcedure.id) }}
            style={[styles.savedButton, savedIds.includes(selectedProcedure.id) && styles.savedButtonActive]}
            onPress={() => toggleSavedProcedure(selectedProcedure.id)}
          >
            <Text style={[styles.savedButtonText, savedIds.includes(selectedProcedure.id) && styles.savedButtonTextActive]}>
              {savedIds.includes(selectedProcedure.id) ? '♥  Salvo nos meus interesses' : '♡  Guardar nos meus interesses'}
            </Text>
          </Pressable>
          <Text style={styles.saveHint}>Sua seleção fica somente nesta sessão de demonstração e não é enviada à clínica.</Text>
          <PrimaryButton label="Consultar disponibilidade" onPress={() => { setService(selectedProcedure.id); changeTab('agenda'); }} />
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <View style={styles.catalogEditorial}>
          <Text style={styles.catalogGold}>BC · CUIDADOS</Text>
          <Text style={styles.catalogEditorialTitle}>Beleza em todas as suas fases.</Text>
          <Text style={styles.catalogEditorialLead}>Explore nossos cuidados e escolha seu próximo momento.</Text>
          <View style={styles.catalogRule} />
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
        <View style={styles.savedFilterRow}>
          <Text style={styles.savedFilterCount}>♡  {savedIds.length} {savedIds.length === 1 ? 'interesse salvo' : 'interesses salvos'}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: showSavedOnly }}
            onPress={() => setShowSavedOnly((v) => !v)}
            style={styles.savedFilterAction}
          >
            <Text style={styles.savedFilterActionText}>{showSavedOnly ? 'Mostrar todos' : 'Ver salvos  ›'}</Text>
          </Pressable>
        </View>
        {visibleProcedures.length ? visibleProcedures.map((item, index) =>
          <ProcedureCard key={item.id} index={index} item={item} onPress={() => setSelectedProcedure(item)} />,
        ) : <Text style={styles.emptyText}>{showSavedOnly ? 'Ainda não há cuidados salvos que combinem com estes filtros.' : 'Nenhum procedimento encontrado.'}</Text>}
      </View>
    );
  }

  function scheduleScreen() {
    return <AgendaDemo requestedProcedureName={procedures.find((item) => item.id === service)?.name || null} />;
  }

  function accountScreen() {
    return <ClientAreaDemo onPrivacyPress={() => setPrivacyOpen(true)} />;
  }

  function privacyScreen() {
    return (
      <View style={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => setPrivacyOpen(false)}>
          <Text style={styles.backLink}>‹ Voltar ao aplicativo</Text>
        </Pressable>
        <View style={styles.privacyHero}>
          <Text style={styles.privacyEyebrow}>BC · CONFIANÇA E TRANSPARÊNCIA</Text>
          <Text style={styles.privacyTitle}>Seu cuidado merece privacidade.</Text>
          <View style={styles.heroRoseLine} />
          <Text style={styles.privacySubtitle}>Informações sobre a versão demonstrativa do aplicativo BC Estética Avançada.</Text>
        </View>
        <View style={styles.privacyInfoCard}>
          <Text style={styles.privacyHeading}>O que acontece nesta prévia?</Text>
          <Text style={styles.privacyBody}>Os catálogos, horários, registros ilustrativos e orientações não consultam a base real da clínica. Nenhuma reserva, mensagem ou documento é enviado.</Text>
          <Text style={styles.privacyBody}>Os procedimentos marcados como interesse e os rascunhos de conversa ficam apenas na memória durante esta prévia. Não há login, conta de cliente ou sincronização nesta versão.</Text>
        </View>
        <View style={styles.privacyInfoCard}>
          <Text style={styles.privacyHeading}>Antes de liberar contas de clientes</Text>
          <Text style={styles.privacyBody}>Disponibilizaremos a política de privacidade oficial, identificaremos o responsável pelo tratamento de dados, revisaremos os acessos a documentos e ofereceremos os canais necessários para solicitar exclusão de conta e dados, respeitando obrigações legais de guarda.</Text>
        </View>
        <View style={styles.privacyInfoCard}>
          <Text style={styles.privacyHeading}>Atendimento e orientações</Text>
          <Text style={styles.privacyBody}>Este aplicativo não faz diagnóstico nem substitui a avaliação de uma profissional habilitada. Os conteúdos sobre procedimentos têm caráter institucional.</Text>
        </View>
        <View style={styles.demoBanner}>
          <Text style={styles.demoText}>VERSÃO DE TESTE · Este texto informativo não substitui a política pública definitiva exigida pela Google Play.</Text>
        </View>
        <PrimaryButton label="Voltar para a BC" onPress={() => setPrivacyOpen(false)} />
      </View>
    );
  }

  const content = privacyOpen ? privacyScreen : {
    inicio: home,
    procedimentos: procedureScreen,
    agenda: scheduleScreen,
    'minha-bc': accountScreen,
  }[tab];

  return (
    <View style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor="#171311" />
      <View style={styles.topBar}>
        <View style={styles.headerSide} />
        <Pressable accessibilityRole="button" accessibilityLabel="Ir para o início da BC" onPress={() => changeTab('inicio')} style={styles.brandBlock}>
          <Image source={require('./assets/app-icon.png')} style={styles.brandImage} resizeMode="contain" accessibilityLabel="Logo dourada BC Estética Avançada" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Informações de privacidade da demonstração" onPress={() => setPrivacyOpen(true)} style={styles.headerInfo}>
          <Text style={styles.headerInfoText}>ⓘ</Text>
        </Pressable>
      </View>
      <ScrollView key={privacyOpen ? 'privacidade' : tab + (selectedProcedure ? selectedProcedure.id : '')} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.flex} contentContainerStyle={styles.scrollContent}>
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
  homeClinicCard: { height: 182, borderRadius: 22, overflow: 'hidden', backgroundColor: '#171310', justifyContent: 'flex-end' },
  homeClinicPhoto: { position: 'absolute', top: 0, right: 0, left: 0, bottom: 0, width: '100%', height: '100%' },
  homeClinicTint: { position: 'absolute', top: 0, right: 0, left: 0, bottom: 0, backgroundColor: 'rgba(14,10,9,0.55)' },
  homeClinicCaption: { padding: 21, gap: 6 },
  homeClinicKicker: { color: '#DEBBAC', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  homeClinicTitle: { color: '#FFF9F3', fontSize: 26, lineHeight: 31, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '600', maxWidth: 260 },
  procedureIndex: { minWidth: 33, color: '#A47C6A', fontSize: 22, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontStyle: 'italic' },
  detailPhoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  detailPhotoTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,13,11,0.70)' },
  detailHeroTitle: { color: '#FFF9F3', fontSize: 29, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '600', lineHeight: 35 },
  catalogEditorial: { minHeight: 214, borderRadius: 20, backgroundColor: '#171310', padding: 24, justifyContent: 'center', gap: 13, marginBottom: 9 },
  catalogEditorialTitle: { fontSize: 37, lineHeight: 43, color: '#FFF9F3', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '600' },
  catalogEditorialLead: { color: '#E7D9D0', fontSize: 15, lineHeight: 22 },
  catalogRule: { width: 61, height: 2, backgroundColor: '#C49B8C', marginTop: 2 },
  headerSide: { width: 44, height: 44 },
  headerInfo: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerInfoText: { color: '#EADBD6', fontSize: 24, fontWeight: '400' },
  homeHero: { minHeight: 396, overflow: 'hidden', backgroundColor: '#171310', justifyContent: 'flex-end' },
  homeHeroPhoto: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, width: '100%', height: '100%' },
  homeHeroTint: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(16,12,10,0.77)' },
  homeHeroInner: { paddingHorizontal: 27, paddingTop: 55, paddingBottom: 30, justifyContent: 'flex-end', minHeight: 375, gap: 15 },
  homeOverline: { color: '#E3BEA9', fontSize: 11, fontWeight: '800', letterSpacing: 2.0 },
  homeHeadline: { color: '#FFF9F3', fontSize: 44, lineHeight: 48, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '600', maxWidth: 330, letterSpacing: -1.2 },
  homeSubline: { color: '#F2EAE5', fontSize: 16, lineHeight: 24, maxWidth: 310 },
  homeMainButton: { borderRadius: 30, backgroundColor: '#D1A99B', paddingVertical: 17, paddingHorizontal: 22, alignSelf: 'flex-start', marginTop: 8, borderWidth: 1, borderColor: '#F2D9C8' },
  homeMainButtonText: { color: '#191417', fontSize: 17, fontWeight: '800' },
  homeContent: { paddingHorizontal: 19, paddingVertical: 23, gap: 22 },
  homeQuickRow: { flexDirection: 'row', gap: 12 },
  homeQuickPrimary: { flex: 1, minHeight: 153, borderRadius: 19, backgroundColor: '#211A1E', padding: 18, gap: 6, borderWidth: 1, borderColor: '#B18A98' },
  homeQuickSecondary: { flex: 1, minHeight: 153, borderRadius: 19, backgroundColor: '#F0EBE5', padding: 18, gap: 6, borderWidth: 1, borderColor: '#C9B9B3' },
  homeQuickIcon: { fontSize: 27, color: '#DEB3BA', marginBottom: 3 },
  homeQuickIconSecondary: { fontSize: 27, color: '#77505C', marginBottom: 3 },
  homeQuickTitlePrimary: { fontSize: 19, color: '#FFF5EE', fontWeight: '800' },
  homeQuickTitleSecondary: { fontSize: 19, color: '#33262B', fontWeight: '800' },
  homeQuickCaptionPrimary: { color: '#E9D9D6', fontSize: 13, lineHeight: 18 },
  homeQuickCaptionSecondary: { color: '#756A6D', fontSize: 13, lineHeight: 18 },
  homeQuickArrowPrimary: { color: '#E0B5BC', fontSize: 19, alignSelf: 'flex-end' },
  homeQuickArrowSecondary: { color: '#7C5661', fontSize: 19, alignSelf: 'flex-end' },
  homeTeamHeading: { gap: 5, marginTop: 5 },
  homeTeamOverline: { color: '#976F7B', letterSpacing: 1.5, fontSize: 12, fontWeight: '800' },
  homeTeamTitle: { color: '#2E2529', fontSize: 31, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '700' },
  homeTeamImageWrap: { width: '100%', height: 205, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#C4B0AF' },
  homeTeamImage: { width: '100%', height: '100%' },
  homePortraitRow: { gap: 11, paddingRight: 19, paddingBottom: 7 },
  homePortraitCard: { width: 140, backgroundColor: '#FFFDFC', padding: 9, borderRadius: 16, borderWidth: 1, borderColor: '#DED1CE', gap: 5 },
  homePortraitImage: { width: 120, height: 134, borderRadius: 11, backgroundColor: '#E7DFDD' },
  homePortraitName: { color: '#302529', fontSize: 17, fontWeight: '800' },
  homePortraitRole: { color: '#70646A', fontSize: 12, lineHeight: 17, minHeight: 34 },
  homePreviewNote: { color: '#877B80', fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 4 },
  heroRoseLine: { width: 72, height: 2, backgroundColor: '#D7A98D', marginBottom: 16 },
  catalogGold: { color: '#E2C4C4', fontSize: 11, letterSpacing: 1.4, fontWeight: '800' },
  detailEyebrow: { color: '#E9BF9E', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 10 },
  brandBlock: { alignItems: 'center', justifyContent: 'center', width: 144, height: 132 },
  brandImage: { width: 132, height: 132 },
  navIconWrap: { width: 55, height: 38, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#49323B', borderColor: '#BE98A6', borderWidth: 1 },

  app: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 48 },
  flex: { flex: 1 },
  topBar: { minHeight: 139, paddingHorizontal: 14, backgroundColor: '#171311', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#B68792' },
  savedButton: { borderWidth: 1.5, borderColor: '#BE909D', borderRadius: 20, padding: 16, backgroundColor: '#F9F3EE', alignItems: 'center', marginVertical: 10 },
  savedButtonActive: { backgroundColor: '#30232A', borderColor: '#DCB2BA' },
  savedButtonText: { fontSize: 15, fontWeight: '800', color: '#6D3F50', textAlign: 'center' },
  savedButtonTextActive: { color: '#FFF0EA' },
  saveHint: { fontSize: 12, lineHeight: 18, color: '#766A6F', textAlign: 'center', marginTop: 0, marginBottom: 10 },
  savedFilterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', paddingVertical: 8, gap: 10 },
  savedFilterCount: { fontSize: 13, color: '#805263', fontWeight: '700' },
  savedFilterAction: { paddingVertical: 10, paddingHorizontal: 13, borderRadius: 14, backgroundColor: '#E6D3D4', borderWidth: 1, borderColor: '#C9A8AF' },
  savedFilterActionText: { fontSize: 13, color: '#452D3A', fontWeight: '800' },
  privacyHero: { backgroundColor: '#171418', borderWidth: 1.5, borderColor: '#D4A8B4', borderRadius: 20, padding: 24, gap: 13 },
  privacyEyebrow: { fontSize: 12, color: '#E6BAC4', fontWeight: '800', letterSpacing: 1.1 },
  privacyTitle: { color: '#FFF7F0', fontSize: 31, lineHeight: 40, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  privacySubtitle: { color: '#F4E3DF', fontSize: 16, lineHeight: 23 },
  privacyInfoCard: { backgroundColor: '#FFF9F4', borderWidth: 1, borderColor: '#D4B9B8', borderRadius: 16, padding: 18, gap: 9 },
  privacyHeading: { color: '#442B37', fontSize: 20, fontWeight: '800' },
  privacyBody: { color: '#554F50', fontSize: 15, lineHeight: 24 },
  scrollContent: { paddingBottom: 30 },
  content: { paddingHorizontal: 20, paddingTop: 23, gap: 12 },
  heading: { marginBottom: 9, gap: 8 },
  eyebrow: { color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  headingTitle: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: colors.ink, fontSize: 31, lineHeight: 38, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  procedureCard: { flexDirection: 'row', gap: 15, alignItems: 'center', paddingVertical: 22, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: '#D8CEC4', minHeight: 112 },
  procedureFamily: { color: '#926D66', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '800', marginBottom: 5 },
  procedureTitle: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 5 },
  procedureCaption: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  chevron: { color: colors.rose, fontSize: 24 },
  primaryButton: { padding: 18, borderRadius: 22, backgroundColor: '#151316', borderWidth: 1, borderColor: '#C2A2AF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  primaryButtonText: { color: '#FFF6EE', fontSize: 15, fontWeight: '800' },
  secondaryButton: { backgroundColor: '#EEDDD9', borderColor: '#C8A4AC' },
  secondaryButtonText: { color: '#231B22' },
  backLink: { color: colors.roseDeep, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  detailBanner: { height: 245, borderRadius: 19, backgroundColor: '#171310', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 22, gap: 14, overflow: 'hidden', marginBottom: 15, borderWidth: 1, borderColor: '#C8ACA0' },
  infoBox: { borderRadius: 12, padding: 17, backgroundColor: '#F9F1EC', marginVertical: 10, gap: 8 },
  infoTitle: { color: colors.roseDeep, fontWeight: '800', fontSize: 17 },
  bodyText: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  input: { minHeight: 52, borderRadius: 13, borderColor: '#D0B6B2', borderWidth: 1, backgroundColor: colors.surface, color: colors.ink, fontSize: 16, paddingHorizontal: 16 },
  chips: { gap: 8, paddingVertical: 5, paddingRight: 12 },
  pill: { borderRadius: 40, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.roseDeep, borderColor: colors.roseDeep },
  pillText: { fontSize: 14, fontWeight: '700', color: colors.roseDeep },
  pillTextActive: { color: '#FFFFFF' },
  demoBanner: { backgroundColor: '#F6E9DD', padding: 12, borderRadius: 9, marginBottom: 5 },
  demoText: { color: colors.warning, fontSize: 10, textAlign: 'center', letterSpacing: 0.6, fontWeight: '800' },
  emptyText: { color: colors.muted, paddingVertical: 25, textAlign: 'center' },
  bottomNav: { flexDirection: 'row', backgroundColor: '#171311', borderTopWidth: 1, borderTopColor: '#C4A0A8', paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 22 : 16 },
  tabButton: { flex: 1, minHeight: 62, alignItems: 'center', gap: 5, justifyContent: 'center' },
  tabIcon: { fontSize: 28, color: '#CEC1BD' },
  tabIconActive: { color: '#EAD7D8' },
  tabText: { fontSize: 14, color: '#EEE3DE', fontWeight: '700' },
  tabTextActive: { color: '#F6EAE2', fontWeight: '800' },
});
