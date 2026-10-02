import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixtureBodyDigest,inspectFixtureMessage} from '../docs/examples/cp-governance-rev1.2/validate.mjs';
const dir=new URL('../docs/examples/cp-governance-rev1.2/',import.meta.url);
const read=file=>JSON.parse(readFileSync(new URL(file,dir),'utf8'));
const {cases}=read('cases.json'),{contexts}=read('contexts.json');
const messages=new Map(cases.map(c=>[c.id,read(c.message)]));
const inspect=id=>{const c=cases.find(c=>c.id===id);return inspectFixtureMessage(c.schema,messages.get(id),contexts[c.context]);};
for(const c of cases)test('offline documentation vector: '+c.id,()=>{
 const result=inspect(c.id);assert.equal(result.wireValid,c.expected.wireValid);assert.equal(result.issue,c.expected.issue);assert.equal(result.contextConsistent,c.expected.issue===null);assert.equal(result.offlineOnly,true);assert.equal(result.qualificationAccepted,false);assert.equal(result.rewardApplied,false);
});
test('qualification clocks are per source stream while canonical participation key is shared',()=>{
 const g=inspect('gca-first-v1-valid'),f=inspect('fs-independent-v1-valid');assert.equal(messages.get('gca-first-v1-valid').sourceRecord.version,1);assert.equal(messages.get('fs-independent-v1-valid').sourceRecord.version,1);assert.equal(g.participationKey,f.participationKey);assert.notEqual(g.sourceStreamKey,f.sourceStreamKey);assert.equal(g.rewardApplied,false);assert.equal(f.rewardApplied,false);
});
test('same Programme does not collapse separately registered concrete units into one key',()=>{
 const a=inspect('gca-first-v1-valid'),b=inspect('separate-unit-same-programme-valid');assert.equal(contexts['gca-first'].project.programmeId,contexts['other-unit-same-programme'].project.programmeId);assert.notEqual(a.participationKey,b.participationKey);assert.notEqual(contexts['gca-first'].project.canonicalUnitRef,contexts['other-unit-same-programme'].project.canonicalUnitRef);
});
test('JSON property order does not change immutable replay; changing fact content does',()=>{
 const original=messages.get('exact-immutable-replay-valid');const reversed=Object.fromEntries(Object.entries(original).reverse());reversed.data=Object.fromEntries(Object.entries(original.data).reverse());assert.equal(fixtureBodyDigest(original),fixtureBodyDigest(reversed));const result=inspectFixtureMessage('qualification',reversed,contexts['gca-head-1']);assert.equal(result.replay,true);assert.equal(result.issue,null);assert.notEqual(fixtureBodyDigest(original),fixtureBodyDigest(messages.get('same-id-changed-body-invalid')));
});
