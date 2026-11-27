import test from 'node:test';
import assert from 'node:assert/strict';
import {prepare} from './prepare.mjs';
const cases=[
  [
    {
      "kind": "client",
      "name": "Pessoa Exemplo",
      "phone": "31900000000"
    },
    "admin",
    "ready_for_review"
  ],
  [
    {
      "kind": "client",
      "name": "Pessoa",
      "phone": ""
    },
    "admin",
    "needs_review"
  ],
  [
    {
      "kind": "payment",
      "clientId": "fake",
      "clientVerified": true,
      "cents": 35000,
      "method": "pix",
      "date": "2026-11-26"
    },
    "admin",
    "ready_for_review"
  ],
  [
    {
      "kind": "payment",
      "clientId": "fake",
      "clientVerified": false,
      "cents": 35000,
      "method": "pix",
      "date": "2026-11-26"
    },
    "admin",
    "needs_review"
  ],
  [
    {
      "kind": "payment",
      "clientId": "fake",
      "clientVerified": true,
      "cents": 1.5,
      "method": "pix",
      "date": "2026-02-30"
    },
    "admin",
    "needs_review"
  ],
  [
    {
      "kind": "document",
      "clientId": "fake",
      "clientVerified": true,
      "title": "Ficha fictícia",
      "category": "documento_digitalizado",
      "fileHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    "admin",
    "ready_for_review"
  ],
  [
    {
      "kind": "document",
      "clientId": "fake",
      "clientVerified": true,
      "title": "Ficha fictícia",
      "category": "unknown",
      "fileHash": ""
    },
    "admin",
    "needs_review"
  ]
];
for(const [i,[input,role,state]] of cases.entries()) test('synthetic '+i,()=>{const r=prepare(input,role);assert.equal(r.state,state);assert.equal(r.persisted,false);});
test('creation role denied',()=>assert.throws(()=>prepare({kind:'payment'},'admin_criacao'),/perfil/));
test('unknown action denied',()=>assert.throws(()=>prepare({kind:'sql'},'admin'),/operacao/));
