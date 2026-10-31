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
import { colors, shadow } from './src/theme';

type Tab = 'inicio' | 'procedimentos' | 'agenda' | 'mensagens' | 'minha-bc';
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
            <Text style={styles.heroGoldMark}>✦  BC · LUXURY BEAUTY EXPERIENCE</Text>
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
          <View style={styles.teamHero}>
            <Image source={require('./assets/team-group.webp')} style={styles.teamHeroPhoto} resizeMode="cover" accessibilityLabel="Foto coletiva institucional da equipe BC Estética Avançada" />
            <View style={styles.teamHeroOverlay}>
              <Text style={styles.teamHeroLabel}>AS PROFISSIONAIS DA BC  ✧</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamRow}>
            {team.map((person) => (
              <Pressable key={person.name} accessibilityRole="button" onPress={() => changeTab('mensagens')} style={styles.teamCard}>
                <View style={styles.teamPortraitPhotoFrame}>
                  <Image source={person.image} resizeMode="cover" style={styles.teamPhoto} accessibilityLabel={person.isGroup ? 'Foto coletiva da BC incluindo Vânia' : 'Foto institucional de ' + person.name} />
                </View>
                {person.isGroup ? <Text style={styles.teamPhotoNote}>FOTO DA EQUIPE</Text> : null}
                <Text style={styles.teamName}>{person.name}</Text>
                <Text style={styles.teamRole}>{person.role}</Text>
                <View style={styles.teamFooter}><Text style={styles.teamFooterText}>EQUIPE BC  ✧</Text></View>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.teamFootnote}>Retratos institucionais da BC. Vânia aparece na foto coletiva; a imagem individual será incluída após confirmação. Atendimentos e permissões profissionais são definidos pela clínica.</Text>

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
            <Text style={styles.previewDisclaimer}>PRÉVIA V0.6 · Este app funciona com dados ilustrativos. Nenhum atendimento, mensagem ou documento real é consultado ou enviado.</Text>
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
        {visibleProcedures.length ? visibleProcedures.map((item) =>
          <ProcedureCard key={item.id} item={item} onPress={() => setSelectedProcedure(item)} />,
        ) : <Text style={styles.emptyText}>{showSavedOnly ? 'Ainda não há cuidados salvos que combinem com estes filtros.' : 'Nenhum procedimento encontrado.'}</Text>}
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
          <Text style={styles.privacyBody}>Os cuidados marcados como interesse e os rascunhos de contato ficam somente na memória enquanto o aplicativo estiver aberto. Não há login, conta de cliente ou sincronização nesta versão.</Text>
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
    mensagens: messagesScreen,
    'minha-bc': accountScreen,
  }[tab];

  return (
    <View style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor="#141316" />
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ir para a tela inicial da BC" onPress={() => changeTab('inicio')} style={styles.brandBlock}>
          <View style={styles.brandSeal}><Image source={require('./assets/logo-transparente.png')} style={styles.brandImage} resizeMode="contain" accessibilityLabel="Identidade visual BC Estética Avançada" /></View>
          <View style={styles.brandWords}>
            <Text style={styles.brandCaption}>BC ESTÉTICA</Text>
            <Text style={styles.brandSubtitle}>AVANÇADA</Text>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          <View style={styles.prototypeBadge}><Text style={styles.prototypeBadgeText}>V0.6 · TESTE</Text></View>
          <Pressable accessibilityRole="button" onPress={() => setPrivacyOpen(true)} style={styles.headerPrivacyButton}>
            <Text style={styles.headerPrivacyText}>Privacidade  ›</Text>
          </Pressable>
        </View>
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
  teamHero: { overflow: 'hidden', height: 254, borderRadius: 19, borderWidth: 1, borderColor: '#C6A3A1', backgroundColor: '#171518', marginTop: 2 },
  teamHeroPhoto: { height: '100%', width: '100%' },
  teamHeroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,14,17,0.83)', paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: '#D9BCC0' },
  teamHeroLabel: { color: '#EFE4D6', fontSize: 13, letterSpacing: 1.5, fontWeight: '800' },
  teamPortraitPhotoFrame: { height: 170, width: '100%', borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: '#D2A4A9', marginBottom: 10, backgroundColor: '#3D3539' },
  teamPhoto: { width: '100%', height: '100%' },
  teamPhotoNote: { color: '#D7B9AE', fontSize: 10, letterSpacing: 0.8, textAlign: 'center', paddingBottom: 4 },
  brandSeal: { width: 76, height: 76, padding: 6, borderRadius: 22, backgroundColor: '#151316', borderWidth: 1.5, borderColor: '#D2B6BB', alignItems: 'center', justifyContent: 'center', shadowColor: '#D5A4B0', shadowOpacity: 0.17, shadowRadius: 9, elevation: 3 },
  heroRingInner: { position: 'absolute', width: 138, height: 138, borderWidth: 1, borderColor: 'rgba(255,224,208,0.25)', borderRadius: 69, right: -62, top: 117 },
  heroEyebrowFrame: { flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 15 },
  heroEyebrowDot: { backgroundColor: '#D4A88C', width: 20, height: 1.5 },
  heroRoseLine: { width: 72, height: 2, backgroundColor: '#D7A98D', marginBottom: 16 },
  signatureRibbon: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#19171A', borderRadius: 17, borderWidth: 1, borderColor: '#CFABB3', padding: 17, gap: 13, marginBottom: 17, overflow: 'hidden' },
  signatureMonogram: { height: 66, width: 66, borderRadius: 35, borderWidth: 1.5, borderColor: '#D7BFC3', backgroundColor: '#30252C', alignItems: 'center', justifyContent: 'center' },
  signatureMonogramText: { color: '#D5B4BA', fontSize: 39 },
  signatureCopy: { flex: 1, gap: 5 },
  signatureEyebrow: { fontSize: 11, letterSpacing: 1.8, fontWeight: '800', color: '#DDB8C1' },
  signatureTitle: { fontSize: 19, color: '#F4ECE3', fontFamily: 'serif', fontWeight: '700' },
  signatureCaption: { fontSize: 12, lineHeight: 18, color: '#DFD1CE' },
  featureCardHalo: { position: 'absolute', top: -50, right: -54, height: 125, width: 125, borderRadius: 65, borderWidth: 1, borderColor: '#E4BBAE', backgroundColor: 'rgba(238,202,191,0.20)' },
  featureThinLine: { height: 1, width: 52, backgroundColor: '#D1B9B7' },
  teamRow: { gap: 13, paddingVertical: 9, paddingRight: 20 },
  teamCard: { width: 182, borderWidth: 1, borderColor: '#C0A0A9', borderRadius: 18, padding: 12, backgroundColor: '#181619', alignItems: 'center', overflow: 'hidden', minHeight: 303 },
  teamPortrait: { height: 96, width: 96, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  teamPortraitInner: { height: 81, width: 81, borderRadius: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDF5F1' },
  teamInitials: { color: '#774353', fontSize: 25, fontFamily: 'serif', fontWeight: '700', letterSpacing: 2 },
  teamName: { color: '#F8EFE6', fontSize: 18, fontWeight: '800' },
  teamRole: { fontSize: 13, color: '#E4D8D6', lineHeight: 18, textAlign: 'center', marginTop: 6, minHeight: 40 },
  teamFooter: { borderTopWidth: 1, borderColor: '#927881', alignSelf: 'stretch', marginTop: 'auto', paddingTop: 10 },
  teamFooterText: { color: '#DEC1C7', fontSize: 11, letterSpacing: 0.9, textAlign: 'center' },
  teamFootnote: { fontSize: 12, color: '#6E6066', lineHeight: 19, marginTop: -3 },
  previewCard: { borderWidth: 1, borderColor: '#C0A0AA', backgroundColor: '#201B22', padding: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
  previewStar: { fontSize: 24, color: '#D6BCC3' },
  catalogHero: { minHeight: 250, backgroundColor: '#141316', borderRadius: 21, padding: 23, gap: 13, overflow: 'hidden', marginBottom: 8, borderWidth: 1, borderColor: '#C7A7B1' },
  catalogHalo: { position: 'absolute', width: 250, height: 250, borderRadius: 125, borderWidth: 1, borderColor: 'rgba(235,184,164,0.28)', right: -120, top: -40 },
  catalogGold: { color: '#E2C4C4', fontSize: 11, letterSpacing: 1.4, fontWeight: '800' },
  catalogTitle: { color: '#FFF7F2', fontFamily: 'serif', fontSize: 36, lineHeight: 42, maxWidth: 275 },
  catalogIntro: { color: '#F3E1E0', fontSize: 15, lineHeight: 23, maxWidth: 285 },
  catalogCount: { color: '#E1C2C8', fontSize: 11, letterSpacing: 1, fontWeight: '700', marginTop: 4 },
  detailDeco: { position: 'absolute', height: 170, width: 170, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(227,178,156,0.33)', right: -35, top: -25 },
  detailEyebrow: { color: '#E9BF9E', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 10 },
  detailFooter: { fontSize: 9, color: '#E9BF9E', letterSpacing: 1.5, marginBottom: 8 },
  contactHero: { backgroundColor: '#171518', borderRadius: 21, padding: 23, gap: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#C3A0AC' },
  contactEyebrow: { color: '#E5BBA2', fontSize: 10, letterSpacing: 1.6, fontWeight: '800' },
  contactTitle: { color: '#FFF5F1', fontSize: 36, fontFamily: 'serif', lineHeight: 43 },
  contactSeparator: { width: 54, height: 2, backgroundColor: '#D8A58F' },
  contactCaption: { color: '#F3E3E2', fontSize: 15, lineHeight: 23 },
  contactSignature: { color: '#EAC3AF', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 7 },
  contactBenefits: { borderWidth: 1, borderColor: '#EBD2C7', borderRadius: 15, backgroundColor: '#F8EDE9', padding: 17, gap: 12 },
  contactBenefitsTitle: { fontFamily: 'serif', fontSize: 19, color: '#613C48', fontWeight: '700' },
  contactBenefit: { fontSize: 14, color: '#51444C', lineHeight: 21 },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  brandImage: { width: 65, height: 65, borderRadius: 12 },
  brandWords: { gap: 3 },
  brandSubtitle: { color: '#DBAAB4', fontSize: 12, letterSpacing: 2.0, fontWeight: '800' },
  heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heroTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(12,12,15,0.73)' },
  heroRing: { position: 'absolute', width: 250, height: 250, borderWidth: 1, borderColor: 'rgba(229,176,151,0.50)', borderRadius: 125, right: -116, top: 76 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  heroGoldMark: { color: '#F1E5D8', fontSize: 10, letterSpacing: 0.7, fontWeight: '800', flexShrink: 1 },
  heroLocation: { color: '#EBD8D3', fontSize: 9, letterSpacing: 0.6 },
  heroBody: { paddingTop: 43, paddingBottom: 28, zIndex: 1 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopColor: 'rgba(255,255,255,0.23)', borderTopWidth: 1, paddingTop: 12, zIndex: 1 },
  heroFooterText: { color: '#ECE1D6', fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  welcomeBlock: { marginVertical: 15, gap: 11 },
  welcomeEyebrow: { color: colors.gold, letterSpacing: 2.0, fontWeight: '800', fontSize: 12 },
  welcomeTitle: { color: colors.ink, fontFamily: 'serif', fontWeight: '600', fontSize: 34, lineHeight: 41 },
  welcomeText: { color: colors.muted, fontSize: 15, lineHeight: 24 },
  highlightCardAccent: { backgroundColor: '#EED7D9', borderWidth: 1, borderColor: '#CA9EA8' },
  highlightArrow: { color: colors.gold, fontWeight: '800', fontSize: 17, alignSelf: 'flex-end', marginTop: 8 },
  sectionHead: { marginTop: 19, gap: 13 },
  goldLine: { height: 3, width: 55, backgroundColor: '#C4927C', borderRadius: 3 },
  featureRow: { gap: 12, paddingVertical: 4, paddingRight: 20 },
  featureCard: { width: 226, minHeight: 295, borderRadius: 19, borderWidth: 1, borderColor: '#B992A0', padding: 18, backgroundColor: '#151316', gap: 10, overflow: 'hidden' },
  featureCardBlush: { backgroundColor: '#292128' },
  featureNumber: { fontSize: 11, color: '#D9BBC0', letterSpacing: 0.75, fontWeight: '800', minHeight: 25 },
  featureIconFrame: { width: 65, height: 65, borderRadius: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: '#392B35', borderWidth: 1.5, borderColor: '#D2B2B7', marginBottom: 4 },
  featureIcon: { fontSize: 33, color: '#E9D9D2' },
  featureTitle: { fontSize: 21, fontFamily: 'serif', color: '#FFF7EF', fontWeight: '700' },
  featureCaption: { fontSize: 13, lineHeight: 20, color: '#E5D8D4', minHeight: 62 },
  featureAction: { fontSize: 12, fontWeight: '800', color: '#E2B3BD', letterSpacing: 1, marginTop: 'auto' },
  spaceRow: { gap: 12, paddingRight: 20, paddingVertical: 5 },
  spaceCard: { backgroundColor: '#171518', borderRadius: 19, overflow: 'hidden', width: 250, borderWidth: 1, borderColor: '#B793A0' },
  spacePhoto: { width: '100%', height: 163 },
  spaceInfo: { padding: 16, gap: 8, backgroundColor: '#171518' },
  spaceName: { color: '#F6EFE7', fontSize: 17, fontWeight: '800' },
  spaceCaption: { color: '#E2D4D2', fontSize: 13, lineHeight: 19 },
  journeyBox: { backgroundColor: '#151317', padding: 23, marginTop: 22, borderRadius: 22, gap: 12, borderWidth: 1, borderColor: '#C7A3AE' },
  journeyEyebrow: { color: '#D6BEC1', fontSize: 12, letterSpacing: 1.7, fontWeight: '800' },
  journeyTitle: { color: '#FFF7F0', fontFamily: 'serif', fontSize: 30, lineHeight: 38 },
  journeyStep: { flexDirection: 'row', gap: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)', paddingTop: 13 },
  journeyNum: { color: '#D7B989', fontSize: 20, fontFamily: 'serif', width: 31 },
  journeyStepTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  journeyStepText: { fontSize: 13, lineHeight: 20, color: '#E7D9DC' },
  journeyButton: { backgroundColor: '#D7B8C1', padding: 17, marginTop: 5, borderRadius: 25 },
  journeyButtonText: { color: '#1D181D', textAlign: 'center', fontWeight: '800', fontSize: 14 },
  previewDisclaimer: { flex: 1, color: '#F2E8E3', fontSize: 12, lineHeight: 19 },
  navIconWrap: { width: 46, height: 32, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#3D2937', borderColor: '#D1AFBA', borderWidth: 1 },

  app: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 48 },
  flex: { flex: 1 },
  topBar: { minHeight: 95, paddingHorizontal: 11, backgroundColor: '#141316', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#D5B8BC' },
  brand: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: colors.roseDeep, fontSize: 31, fontWeight: '700', letterSpacing: 2, lineHeight: 34 },
  brandCaption: { color: '#E6DDD0', letterSpacing: 1.0, fontSize: 11, fontWeight: '800' },
  prototypeBadge: { paddingVertical: 9, paddingHorizontal: 9, backgroundColor: '#30242C', borderColor: '#A87784', borderWidth: 1, borderRadius: 50 },
  headerActions: { alignItems: 'flex-end', justifyContent: 'center', gap: 6, flexShrink: 0 },
  headerPrivacyButton: { borderBottomWidth: 1, borderBottomColor: '#D1A6B2', paddingHorizontal: 3, paddingVertical: 3 },
  headerPrivacyText: { fontSize: 11, color: '#F5E5E7', fontWeight: '700' },
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
  prototypeBadgeText: { fontSize: 9, letterSpacing: 0.3, fontWeight: '800', color: '#F3E9DF' },
  scrollContent: { paddingBottom: 30 },
  content: { paddingHorizontal: 20, paddingTop: 23, gap: 12 },
  hero: { overflow: 'hidden', padding: 22, backgroundColor: '#121114', minHeight: 482, justifyContent: 'space-between', borderBottomWidth: 4, borderBottomColor: '#D2A6AE' },
  heroDecor: { width: 230, height: 230, position: 'absolute', right: -80, top: -50, backgroundColor: '#F8EDE9', borderRadius: 115, opacity: 0.7 },
  heroEyebrow: { color: '#E8B7C0', fontSize: 11, letterSpacing: 0.65, fontWeight: '800', flexShrink: 1 },
  heroTitle: { maxWidth: 330, fontSize: 40, lineHeight: 48, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: '#FFF9F3', fontWeight: '700', marginBottom: 15 },
  heroDescription: { maxWidth: 320, fontSize: 16, lineHeight: 24, color: '#F2E9E4', marginBottom: 22 },
  heroButton: { backgroundColor: '#D7B3B9', paddingHorizontal: 23, paddingVertical: 17, alignSelf: 'flex-start', borderRadius: 26, borderWidth: 1, borderColor: '#F5E8D8' },
  heroButtonText: { color: '#181419', fontWeight: '800', fontSize: 15 },
  heading: { marginBottom: 9, gap: 8 },
  eyebrow: { color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  headingTitle: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: colors.ink, fontSize: 31, lineHeight: 38, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  highlightRow: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  highlightCard: { flex: 1, backgroundColor: '#FFFCF8', padding: 18, borderRadius: 17, minHeight: 163, borderColor: '#D3B8B5', borderWidth: 1, ...shadow },
  highlightIcon: { fontSize: 26, color: colors.rose, marginBottom: 8 },
  highlightTitle: { color: colors.ink, fontWeight: '800', fontSize: 17, marginBottom: 5 },
  highlightCaption: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  procedureCard: { flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: '#FFFDF9', padding: 16, borderRadius: 15, marginBottom: 4, borderWidth: 1, borderColor: '#DBC8C1' },
  procedureIcon: { backgroundColor: colors.blush, width: 54, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  procedureIconText: { fontSize: 27, color: colors.roseDeep },
  procedureFamily: { color: colors.roseDeep, fontSize: 11, letterSpacing: 1.0, textTransform: 'uppercase', fontWeight: '800', marginBottom: 4 },
  procedureTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 5 },
  procedureCaption: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  chevron: { color: colors.rose, fontSize: 24 },
  primaryButton: { padding: 18, borderRadius: 22, backgroundColor: '#151316', borderWidth: 1, borderColor: '#C2A2AF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  primaryButtonText: { color: '#FFF6EE', fontSize: 15, fontWeight: '800' },
  secondaryButton: { backgroundColor: '#EEDDD9', borderColor: '#C8A4AC' },
  secondaryButtonText: { color: '#231B22' },
  backLink: { color: colors.roseDeep, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  detailBanner: { height: 225, borderRadius: 20, backgroundColor: '#161418', alignItems: 'center', justifyContent: 'space-around', overflow: 'hidden', marginBottom: 15, borderWidth: 1, borderColor: '#C7A6AE' },
  detailGlyph: { fontSize: 86, color: '#E5B49C' },
  infoBox: { borderRadius: 12, padding: 17, backgroundColor: '#F9F1EC', marginVertical: 10, gap: 8 },
  infoTitle: { color: colors.roseDeep, fontWeight: '800', fontSize: 17 },
  bodyText: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  input: { minHeight: 52, borderRadius: 13, borderColor: '#D0B6B2', borderWidth: 1, backgroundColor: colors.surface, color: colors.ink, fontSize: 16, paddingHorizontal: 16 },
  chips: { gap: 8, paddingVertical: 5, paddingRight: 12 },
  pill: { borderRadius: 40, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.roseDeep, borderColor: colors.roseDeep },
  pillText: { fontSize: 14, fontWeight: '700', color: colors.roseDeep },
  pillTextActive: { color: '#FFFFFF' },
  sectionLabel: { color: colors.ink, fontWeight: '800', fontSize: 18, marginTop: 14 },
  demoBanner: { backgroundColor: '#F6E9DD', padding: 12, borderRadius: 9, marginBottom: 5 },
  demoText: { color: colors.warning, fontSize: 10, textAlign: 'center', letterSpacing: 0.6, fontWeight: '800' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  timeCell: { minWidth: '29%' },
  emptyText: { color: colors.muted, paddingVertical: 25, textAlign: 'center' },
  conversationCard: { backgroundColor: colors.surface, flexDirection: 'row', gap: 13, alignItems: 'center', padding: 16, borderRadius: 13, borderWidth: 1, borderColor: colors.line },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.roseDeep, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  conversationTitle: { fontSize: 17, color: colors.ink, fontWeight: '800', marginBottom: 5 },
  conversationCaption: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  messageInput: { minHeight: 115, textAlignVertical: 'top', paddingTop: 14 },
  inputHint: { color: colors.muted, fontSize: 11 },
  accountCard: { alignItems: 'center', borderRadius: 16, backgroundColor: colors.blush, padding: 25, gap: 9 },
  accountAvatar: { backgroundColor: colors.surface, borderRadius: 40, width: 65, height: 65, alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { fontSize: 30, color: colors.rose },
  accountTitle: { color: colors.roseDeep, fontSize: 17, fontWeight: '700' },
  bodyTextCentered: { textAlign: 'center', color: colors.muted, fontSize: 12, lineHeight: 19 },
  accountItem: { flexDirection: 'row', gap: 12, padding: 15, backgroundColor: colors.surface, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.line },
  accountItemIcon: { fontSize: 24, color: colors.rose, width: 35, textAlign: 'center' },
  bottomNav: { flexDirection: 'row', backgroundColor: '#131215', borderTopWidth: 1.5, borderTopColor: '#C9A6B3', paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 13 },
  tabButton: { flex: 1, alignItems: 'center', gap: 5 },
  tabIcon: { fontSize: 24, color: '#CEC1BD' },
  tabIconActive: { color: '#EAD7D8' },
  tabText: { fontSize: 11, color: '#E6DAD4', fontWeight: '700' },
  tabTextActive: { color: '#F6EAE2', fontWeight: '800' },
});
