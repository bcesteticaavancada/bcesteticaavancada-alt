import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';
test('PDF da ficha inclui parâmetros e anotação livre do equipamento',async()=>{
 const raw=await readFile(new URL('../../supabase/functions/generate-clinical-pdf/pdf.ts',import.meta.url),'utf8');
 const source=stripTypeScriptTypes(raw.replace(/^import .*from 'pdf-lib';\s*/m,''));
 const {buildTreatment6dSections}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const sections=buildTreatment6dSections({equipment_usages:[{equipment_name_snapshot:'Laser fictício',parameter_values:{potencia:2},usage_notes:'Ponteira registrada livremente'}]});
 assert.ok(sections[0].lines.includes('Parâmetros: potencia: 2'));
 assert.ok(sections[0].lines.some(line=>line.includes('Ponteira registrada livremente')));
});
