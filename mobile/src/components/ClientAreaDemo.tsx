import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Panel = 'pos' | 'conversa' | 'arquivos';
type Motivo = 'Dúvida' | 'Reação' | 'Intercorrência';

const sections: { id: Panel; label: string; icon: string }[] = [
  { id: 'pos', label: 'Pós', icon: '♡' },
  { id: 'conversa', label: 'Conversas', icon: '✉' },
  { id: 'arquivos', label: 'Arquivos', icon: '▤' },
];

const motivos: Motivo[] = ['Dúvida', 'Reação', 'Intercorrência'];

/**
 * UI de homologação sem Auth, backend, PDF, mensagens ou arquivos reais.
 * Não utilizar textos ou dados de pacientes nesta prévia.
 */
export default function ClientAreaDemo({ onPrivacyPress }: { onPrivacyPress: () => void }) {
  const [panel, setPanel] = useState<Panel>('pos');
  const [motivo, setMotivo] = useState<Motivo>('Dúvida');
  const [rascunho, setRascunho] = useState('');

  function simularEnvio() {
    Alert.alert(
      'Prévia da BC',
      'Nenhuma mensagem foi enviada. A comunicação direta exigirá uma conta verificada e vinculação à profissional responsável.',
      [{ text: 'Entendi' }],
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>MINHA BC  ·  ÁREA RESERVADA</Text>
        <Text style={styles.heroTitle}>Seu cuidado continua aqui.</Text>
        <Text style={styles.heroCaption}>Pós-atendimento e contato com sua profissional, em um só lugar.</Text>
      </View>

      <Text style={styles.previewNote}>PRÉVIA PRIVADA · Nenhum cadastro ou atendimento real está conectado.</Text>

      <View style={styles.tabBar}>
        {sections.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: panel === item.id }}
            onPress={() => setPanel(item.id)}
            style={[styles.tab, panel === item.id && styles.tabActive]}
          >
            <Text style={[styles.tabIcon, panel === item.id && styles.tabIconActive]}>{item.icon}</Text>
            <Text style={[styles.tabLabel, panel === item.id && styles.tabLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {panel === 'pos' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pós-atendimento</Text>
          <Text style={styles.sectionLead}>O acompanhamento da BC, de maneira próxima e individual.</Text>
          <View style={styles.highlightCard}>
            <Text style={styles.cardOverline}>APÓS SEU PROCEDIMENTO</Text>
            <Text style={styles.cardTitle}>Orientações só para você.</Text>
            <Text style={styles.cardDescription}>Cuidados aprovados pela profissional e próximos passos vinculados ao seu atendimento.</Text>
            <Text style={styles.cardStatus}>♡  Acesso após identificação segura</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={styles.actionCard}
            onPress={() => { setPanel('conversa'); setMotivo('Reação'); }}
          >
            <View style={styles.actionIcon}><Text style={styles.actionIconText}>✉</Text></View>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>Precisa de orientação?</Text>
              <Text style={styles.actionDescription}>Dúvidas, reações e intercorrências.</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        </View>
      ) : null}

      {panel === 'conversa' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fale com sua profissional</Text>
          <Text style={styles.sectionLead}>Um canal de acompanhamento vinculado ao seu atendimento.</Text>
          <Text style={styles.fieldLabel}>Sobre o que deseja conversar?</Text>
          <View style={styles.motivos}>
            {motivos.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: motivo === item }}
                style={[styles.motivo, motivo === item && styles.motivoSelected]}
                onPress={() => setMotivo(item)}
              >
                <Text style={[styles.motivoText, motivo === item && styles.motivoTextSelected]}>{item}</Text>
              </Pressable>
            ))}
          </View>
          {motivo !== 'Dúvida' ? (
            <View style={styles.urgency}>
              <Text style={styles.urgencyTitle}>Sua segurança vem primeiro.</Text>
              <Text style={styles.urgencyText}>Este canal não é um serviço de emergência. Em uma situação grave ou urgente, procure atendimento imediato e não aguarde resposta pelo aplicativo.</Text>
            </View>
          ) : null}
          <TextInput
            multiline
            accessibilityLabel="Mensagem fictícia para demonstração"
            value={rascunho}
            onChangeText={setRascunho}
            placeholder="Mensagem de teste..."
            placeholderTextColor="#8F8586"
            style={styles.composer}
          />
          <Text style={styles.draftNote}>Não inclua dados pessoais ou de saúde nesta prévia. Nada será enviado ou salvo.</Text>
          <Pressable accessibilityRole="button" onPress={simularEnvio} style={styles.mainButton}>
            <Text style={styles.mainButtonText}>Simular envio da mensagem  ›</Text>
          </Pressable>
        </View>
      ) : null}

      {panel === 'arquivos' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seus documentos</Text>
          <Text style={styles.sectionLead}>Tudo organizado por atendimento, com acesso individual.</Text>
          <View style={styles.documentCard}>
            <Text style={styles.documentIcon}>▤</Text>
            <View style={styles.documentText}>
              <Text style={styles.documentTitle}>Orientações e cuidados</Text>
              <Text style={styles.documentSubtitle}>Liberados pela profissional responsável.</Text>
            </View>
            <Text style={styles.lockIcon}>⌁</Text>
          </View>
          <View style={styles.documentCard}>
            <Text style={styles.documentIcon}>◇</Text>
            <View style={styles.documentText}>
              <Text style={styles.documentTitle}>Termos e documentos</Text>
              <Text style={styles.documentSubtitle}>Disponíveis após autenticação e revisão.</Text>
            </View>
            <Text style={styles.lockIcon}>⌁</Text>
          </View>
          <Text style={styles.draftNote}>Nenhum prontuário, PDF ou arquivo de paciente foi incluído no aplicativo de teste.</Text>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={onPrivacyPress} style={styles.privacyLink}>
        <Text style={styles.privacyLinkText}>Privacidade e proteção de dados  ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 19, paddingTop: 20, paddingBottom: 36, gap: 18 },
  hero: { backgroundColor: '#171310', borderRadius: 22, paddingHorizontal: 23, paddingVertical: 28, gap: 12, borderWidth: 1, borderColor: '#B68A82' },
  eyebrow: { color: '#D8B6AB', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: '#FFF9F3', fontSize: 37, lineHeight: 44, fontFamily: 'serif', fontWeight: '600', maxWidth: 310 },
  heroCaption: { color: '#EADFD8', fontSize: 15, lineHeight: 23 },
  previewNote: { color: '#766A6E', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  tabBar: { backgroundColor: '#F2E9DF', padding: 5, borderRadius: 18, flexDirection: 'row', gap: 5, borderWidth: 1, borderColor: '#D8CEC4' },
  tab: { flex: 1, minHeight: 77, justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: 15 },
  tabActive: { backgroundColor: '#241B19', borderWidth: 1, borderColor: '#B68A82' },
  tabIcon: { color: '#7E5A51', fontSize: 24 },
  tabIconActive: { color: '#DAB7AA' },
  tabLabel: { color: '#524843', fontWeight: '800', fontSize: 15 },
  tabLabelActive: { color: '#FFF9F3' },
  section: { gap: 14 },
  sectionTitle: { color: '#211B18', fontSize: 30, fontFamily: 'serif', fontWeight: '700' },
  sectionLead: { color: '#756C66', fontSize: 15, lineHeight: 22 },
  highlightCard: { backgroundColor: '#241C18', borderRadius: 20, padding: 23, minHeight: 214, gap: 12, borderWidth: 1, borderColor: '#B58B7D' },
  cardOverline: { color: '#D7B6A8', fontWeight: '800', letterSpacing: 1.6, fontSize: 12 },
  cardTitle: { color: '#FFF6EF', fontFamily: 'serif', fontSize: 27, lineHeight: 34, fontWeight: '700' },
  cardDescription: { color: '#E9DDD5', fontSize: 15, lineHeight: 22 },
  cardStatus: { color: '#D8B4A5', fontSize: 12, marginTop: 3, fontWeight: '800' },
  actionCard: { flexDirection: 'row', backgroundColor: '#FFFDFB', padding: 17, gap: 12, alignItems: 'center', borderWidth: 1, borderColor: '#D8CEC4', borderRadius: 18 },
  actionIcon: { width: 49, height: 49, borderRadius: 24, backgroundColor: '#EAD9D9', alignItems: 'center', justifyContent: 'center' },
  actionIconText: { fontSize: 23, color: '#6C4554' },
  actionBody: { flex: 1, gap: 5 },
  actionTitle: { color: '#33272D', fontSize: 17, fontWeight: '800' },
  actionDescription: { color: '#73676B', fontSize: 13, lineHeight: 20 },
  actionArrow: { color: '#A17784', fontSize: 26 },
  fieldLabel: { fontSize: 16, fontWeight: '800', color: '#3B2B32' },
  motivos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motivo: { borderRadius: 22, borderWidth: 1, borderColor: '#D5BFBE', backgroundColor: '#FFFDFB', paddingHorizontal: 14, paddingVertical: 13 },
  motivoSelected: { backgroundColor: '#2A201C', borderColor: '#B68682' },
  motivoText: { color: '#573E48', fontSize: 14, fontWeight: '800' },
  motivoTextSelected: { color: '#FFF3ED' },
  urgency: { backgroundColor: '#F7F1EE', borderLeftWidth: 3, borderLeftColor: '#9A6E7D', borderRadius: 10, padding: 15, gap: 6 },
  urgencyTitle: { color: '#513B44', fontWeight: '800', fontSize: 16 },
  urgencyText: { color: '#61575B', fontSize: 14, lineHeight: 21 },
  composer: { backgroundColor: '#FFFDFB', borderWidth: 1, borderColor: '#D8C7C3', minHeight: 116, borderRadius: 16, padding: 16, paddingTop: 15, fontSize: 16, color: '#2D2428', textAlignVertical: 'top' },
  draftNote: { color: '#776C70', fontSize: 12, lineHeight: 19 },
  mainButton: { padding: 18, minHeight: 58, backgroundColor: '#241B18', borderRadius: 29, justifyContent: 'center', borderWidth: 1, borderColor: '#B68682' },
  mainButtonText: { color: '#FFF7F2', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  documentCard: { backgroundColor: '#FFFDFB', flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#D9C8C5', gap: 12 },
  documentIcon: { color: '#8F6675', fontSize: 29 },
  documentText: { flex: 1, gap: 4 },
  documentTitle: { color: '#30231E', fontSize: 16, fontWeight: '800' },
  documentSubtitle: { color: '#766A6F', fontSize: 13, lineHeight: 19 },
  lockIcon: { color: '#AD93A0', fontSize: 21 },
  privacyLink: { borderTopWidth: 1, borderTopColor: '#D5C8C6', paddingTop: 19, paddingBottom: 12, marginTop: 6 },
  privacyLinkText: { color: '#6D4353', fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
