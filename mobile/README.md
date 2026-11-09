# BC Estética Avançada · Beta Android

O pacote Capacitor reaproveita as páginas públicas do site. A navegação tem acesso direto a Início, Agendar, Campanhas e Meus horários. Os vídeos usam o endereço oficial da BC.

A agenda usa procedimentos, profissionais e horários fictícios. As confirmações são salvas no aparelho com os dados da reserva de teste. Os campos de identificação são preenchidos com dados fictícios. O ambiente de homologação com Supabase será a próxima integração.

## Compilar

Requisitos de desenvolvimento: Node.js 22 ou superior, JDK 21, Android SDK 36 e Android Build Tools 36.0.0.

Na raiz do repositório:

```sh
npm --prefix mobile ci
npm --prefix mobile test
npm --prefix mobile run android:debug
```

APK de teste: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
