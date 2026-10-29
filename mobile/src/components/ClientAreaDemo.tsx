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
      <Text style={styles.eyebrow}>ESPAÇO DA CLIENTE</Text>
      <Text style={styles.heading}>Minha BC</Text>
      <Text style={styles.caption}>Um lugar dedicado à sua jornada, seus atendimentos e suas orientações.</Text>
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
  content: { paddingHorizontal: 20, paddingTop: 23, gap: 13, paddingBottom: 28 },
  eyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' },
  heading: { color: colors.ink, fontFamily: 'serif', fontSize: 29, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  warning: { backgroundColor: colors.blush, padding: 15, borderRadius: 12, gap: 6 },
  warningTitle: { fontSize: 10, fontWeight: '800', color: colors.roseDeep, letterSpacing: 1 },
  warningText: { color: colors.roseDeep, fontSize: 12, lineHeight: 18 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.surface, borderRadius: 13, padding: 16, borderColor: colors.line, borderWidth: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.roseDeep, fontSize: 29 },
  grow: { flex: 1 },
  welcome: { fontSize: 15, color: colors.ink, fontWeight: '700', marginBottom: 5 },
  small: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  panels: { gap: 9, paddingVertical: 4 },
  panel: { borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  panelActive: { backgroundColor: colors.roseDeep, borderColor: colors.roseDeep },
  panelText: { fontSize: 12, color: colors.ink, fontWeight: '700' },
  panelTextActive: { color: '#FFFFFF' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, color: colors.ink, fontWeight: '700', marginTop: 4 },
  body: { color: colors.muted, lineHeight: 18, fontSize: 12 },
  item: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 15, flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemIcon: { fontSize: 24, color: colors.roseDeep },
  itemTitle: { fontSize: 13, color: colors.ink, fontWeight: '700', marginBottom: 4 },
  note: { fontSize: 12, color: colors.muted, lineHeight: 19, marginTop: 4 },
  button: { backgroundColor: colors.roseDeep, padding: 17, borderRadius: 10 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 18 },
});
