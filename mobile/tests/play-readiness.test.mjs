import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const get = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const expo = JSON.parse(get('../app.json')).expo;
const pkg = JSON.parse(get('../package.json'));
const eas = JSON.parse(get('../eas.json'));
const app = get('../App.tsx');

test('versão e identificadores Android/iOS de lançamento devem ser estáveis', () => {
  assert.equal(expo.version, '0.7.0');
  assert.equal(pkg.version, expo.version);
  assert.equal(expo.android.versionCode, 7);
  assert.equal(expo.android.package, 'br.com.bcesteticaavancada.app');
  assert.equal(expo.ios.bundleIdentifier, 'br.com.bcesteticaavancada.app');
  assert.equal(expo.extra.prototype, true);
  assert.equal(expo.extra.playProductionEnabled, false);
});

test('prévia usa APK; perfil futuro de loja usa AAB', () => {
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.production.distribution, 'store');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
});

test('fluxo oferece voltar, privacidade e favoritos locais demonstrativos', () => {
  assert.match(app, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(app, /function privacyScreen\(\)/);
  assert.match(app, /Guard[a-z]+ nos meus interesses/);
  assert.match(app, /setSavedIds/);
  assert.match(app, /accessibilityLabel="Informações de privacidade da demonstração"/);
  assert.match(app, /key=\{privacyOpen \?/);
  assert.match(app, /não substitui a política pública definitiva/);
});

test('documentação de portas de aprovação presente e sem URLs clínicas na tela demonstrativa', () => {
  const doc = get('../docs/google-play-gates.md');
  assert.match(doc, /AAB/);
  assert.match(doc, /política de privacidade/);
  assert.match(doc, /dados fictícios/);
  assert.doesNotMatch(app, /https?:\/\/tpqsmerlxquyrzrjbogj\.supabase\.co/);
});

test('V0.7 usa logo grande sem distorção e quatro abas acessíveis', () => {
  assert.match(app, /source=\{require\('\.\/assets\/app-icon\.png'\)\}/);
  assert.match(app, /resizeMode="contain"/);
  assert.match(app, /height: 132/);
  assert.doesNotMatch(app, /\{ id: 'mensagens', label: 'Contato'/);
  const tabs = app.match(/\{ id: '(inicio|procedimentos|agenda|minha-bc)', label:/g);
  assert.equal(tabs?.length, 4);
});

test('Pós-atendimento e chat são prévias locais, sem dados clínicos', () => {
  const area = get('../src/components/ClientAreaDemo.tsx');
  assert.match(area, /Pós-atendimento/);
  assert.match(area, /Fale com sua profissional/);
  assert.match(area, /'Dúvida', 'Reação', 'Intercorrência'/);
  assert.match(area, /Nenhuma mensagem foi enviada/);
  assert.match(area, /não é um serviço de emergência/);
  assert.doesNotMatch(area, /fetch\(|supabase\.from\(|\.invoke\(/);
});
