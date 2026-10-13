# Hotfix — erro de PDF no Storage privado

Data: 2026-10-13

## Causa raiz confirmada

A Edge Function `generate-anamnese-pdf` conseguiu montar o PDF e baixar/verificar as assinaturas, mas o upload final para `bc-prontuario-private` foi rejeitado pelo Supabase Storage com `InvalidMimeType`: `application/pdf` não estava entre os MIME types permitidos pelo bucket.

A configuração original da Fase 6A restringiu `allowed_mime_types` a `image/jpeg`, `image/png` e `image/webp`. As Fases 6B/6C passaram a gerar PDFs no mesmo bucket, mas não ampliaram essa lista.

## Correção esperada

Preservar o bucket privado e o limite atual, acrescentando `application/pdf` aos MIME types aceitos. O teste `tests/gestao/storage-pdf-mime-regression.test.mjs` protege essa integração contra regressão futura.
