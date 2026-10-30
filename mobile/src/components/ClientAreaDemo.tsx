import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

type Panel = 'historico' | 'orientacoes' | 'documentos';
const panels: { id: Panel; label: string }[] = [
  { id: 'historico', label: 'Histórico' },
  { id: 'orientacoes', label: 'Cuidados' },
  { id: 'documentos', label: 'Documentos' },
];

/**
 * Nenhum dado real ou fictício identificável é persistido.
 * Este componente não acessa a BC Gestão, Auth, Drive ou PDFs.
 */
export default function ClientAreaDemo() {
  const [panel, setPanel] = useState<Panel>('historico');

  function privacyNotice() {
    Alert.alert(
      'Área privativa em construção',
      'A versão real exigirá login, verificação de identidade e regras de acesso por cliente. Nada é baixado, compartilhado ou enviado nesta demonstração.',
    );
  }

  return (
    <View style={styles.content}>
      <View style={styles.clientHero}>
        <View style={styles.clientHalo} />
        <Text style={styles.eyebrow}>BC · UM ESPAÇO SÓ SEU</Text>
        <Text style={styles.heading}>Sua história de cuidado, com carinho.</Text>
        <View style={styles.heroRule} />
        <Text style={styles.caption}>Seus atendimentos, orientações e documentos, em uma experiência pessoal e protegida.</Text>
        <Text style={styles.heroCaption}>MINHA BC  ·  PRIVATE EXPERIENCE  ✧</Text>
      </View>
      <View style={styles.warning}>
        <Text style={styles.warningTitle}>PRÉVIA COM DADOS FICTÍCIOS</Text>
        <Text style={styles.warningText}>Você não está conectada a uma conta. Os exemplos abaixo não representam pacientes ou procedimentos realizados na clínica.</Text>
      </View>
      <View style={styles.intro}>
        <View style={styles.avatar}><Text style={styles.avatarText}>♡</Text></View>
        <View style={styles.grow}>
          <Text style={styles.welcome}>Seu cuidado, em um só lugar</Text>
          <Text style={styles.small}>A área real só aparecerá após autenticação e autorização individual.</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panels}>
        {panels.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: panel === item.id }}
            onPress={() => setPanel(item.id)}
            style={[styles.panel, panel === item.id && styles.panelActive]}
          >
            <Text style={[styles.panelText, panel === item.id && styles.panelTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {panel === 'historico' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Como aparecerá seu histórico</Text>
          <Text style={styles.body}>Exemplos visuais, sem registros reais ou datas de atendimento.</Text>
          <View style={styles.item}>
            <Text style={styles.itemIcon}>✧</Text>
            <View style={styles.grow}>
              <Text style={styles.itemTitle}>Exemplo · Limpeza de pele</Text>
              <Text style={styles.small}>Atendimento ilustrativo · informações a confirmar</Text>
            </View>
          </View>
          <View style={styles.item}>
            <Text style={styles.itemIcon}>✺</Text>
            <View style={styles.grow}>
              <Text style={styles.itemTitle}>Exemplo · Avaliação estética</Text>
              <Text style={styles.small}>Registro ilustrativo · informações a confirmar</Text>
            </View>
          </View>
          <Text style={styles.note}>Na versão real, cada cliente verá somente seus próprios registros autorizados pela BC, vinculados ao cadastro existente.</Text>
        </View>
      ) : null}

      {panel === 'orientacoes' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orientações da sua profissional</Text>
          <View style={styles.item}>
            <Text style={styles.itemIcon}>♡</Text>
            <View style={styles.grow}>
              <Text style={styles.itemTitle}>Orientações personalizadas</Text>
              <Text style={styles.small}>A profissional responsável poderá disponibilizar orientações específicas de cada atendimento.</Text>
            </View>
          </View>
          <View style={styles.item}>
            <Text style={styles.itemIcon}>✉</Text>
            <View style={styles.grow}>
              <Text style={styles.itemTitle}>Contato com a equipe</Text>
              <Text style={styles.small}>Canal privativo com acesso conforme o vínculo de atendimento.</Text>
            </View>
          </View>
          <Text style={styles.note}>Nenhuma prescrição, recomendação clínica individual ou mensagem é gerada nesta prévia.</Text>
        </View>
      ) : null}

      {panel === 'documentos' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seus documentos</Text>
          <View style={styles.item}>
            <Text style={styles.itemIcon}>▤</Text>
            <View style={styles.grow}>
              <Text style={styles.itemTitle}>Anamneses e consentimentos</Text>
              <Text style={styles.small}>Em breve, documentos revisados e liberados para cada cliente.</Text>
            </View>
          </View>
          <View style={styles.item}>
            <Text style={styles.itemIcon}>▣</Text>
            <View style={styles.grow}>
              <Text style={styles.itemTitle}>Arquivos de procedimentos</Text>
              <Text style={styles.small}>Acesso individual com autorização e controle de expiração.</Text>
            </View>
          </View>
          <Text style={styles.note}>Não há arquivos reais ou PDFs disponíveis neste protótipo. Nada é sincronizado com o Google Drive.</Text>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={privacyNotice} style={styles.button}>
        <Text style={styles.buttonText}>Como será protegido meu acesso ›</Text>
      </Pressable>
      <Text style={styles.footer}>Antes da liberação: Auth, regras de acesso por cliente, testes de isolamento, revisão da Mel e autorização de publicação.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  clientHero: { backgroundColor: '#171518', borderRadius: 20, padding: 23, gap: 15, minHeight: 267, overflow: 'hidden', borderWidth: 1, borderColor: '#BD9AA7' },
  clientHalo: { position: 'absolute', right: -85, top: -65, width: 215, height: 215, borderWidth: 1, borderColor: 'rgba(232,186,165,0.36)', borderRadius: 110 },
  heroRule: { height: 2, width: 64, backgroundColor: '#E4B69C' },
  heroCaption: { fontSize: 11, color: '#DFC5C9', letterSpacing: 1.0, fontWeight: '800', marginTop: 6 },
  content: { paddingHorizontal: 20, paddingTop: 23, gap: 13, paddingBottom: 28 },
  eyebrow: { color: '#E7D6D6', fontSize: 12, letterSpacing: 1.3, fontWeight: '800' },
  heading: { color: '#FFF7F3', fontFamily: 'serif', fontSize: 34, lineHeight: 43, fontWeight: '600', maxWidth: 280 },
  caption: { color: '#F0E5E0', fontSize: 15, lineHeight: 23 },
  warning: { backgroundColor: '#F6E5DE', padding: 15, borderRadius: 14, gap: 6, borderWidth: 1, borderColor: '#EAC9BF' },
  warningTitle: { fontSize: 12, fontWeight: '800', color: colors.roseDeep, letterSpacing: 0.9 },
  warningText: { color: '#543B48', fontSize: 14, lineHeight: 21 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#FFFCF8', borderRadius: 16, padding: 18, borderColor: '#D2B9BC', borderWidth: 1 },
  avatar: { width: 55, height: 55, borderRadius: 29, backgroundColor: '#F4DED8', borderWidth: 1, borderColor: '#CEA18E', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.roseDeep, fontSize: 29 },
  grow: { flex: 1 },
  welcome: { fontSize: 18, color: colors.ink, fontWeight: '800', marginBottom: 6 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  panels: { gap: 9, paddingVertical: 4 },
  panel: { borderRadius: 24, paddingHorizontal: 19, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#D7C0BF' },
  panelActive: { backgroundColor: '#332630', borderColor: '#BA96A3' },
  panelText: { fontSize: 14, color: colors.ink, fontWeight: '700' },
  panelTextActive: { color: '#FFFFFF' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 23, color: colors.ink, fontFamily: 'serif', fontWeight: '700', marginTop: 7 },
  body: { color: colors.muted, lineHeight: 21, fontSize: 14 },
  item: { backgroundColor: '#FFFCF8', borderRadius: 16, borderWidth: 1, borderColor: '#D9C7C2', padding: 18, flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemIcon: { fontSize: 24, color: colors.roseDeep },
  itemTitle: { fontSize: 16, color: colors.ink, fontWeight: '800', marginBottom: 6 },
  note: { fontSize: 14, color: colors.muted, lineHeight: 22, marginTop: 5 },
  button: { backgroundColor: '#181619', padding: 19, borderRadius: 25, borderWidth: 1, borderColor: '#B895A5' },
  buttonText: { color: '#FFF8EF', fontWeight: '800', fontSize: 15 },
  footer: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
