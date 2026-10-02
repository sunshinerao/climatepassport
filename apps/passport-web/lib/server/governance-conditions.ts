/** CP-GOV-009: finite typed conditions; empty conditions explicitly mean unconditional. */
export type QualificationFacts = {kind:string;status:string;verificationLevel:"source_verified";durationMinutes?:number;score?:number;evidenceRefs:string[]};
export type TypedCondition = {schemaVersion:"cp-condition/1";all:Array<{field:"kind"|"status"|"verificationLevel";op:"eq";value:string}|{field:"durationMinutes"|"score";op:"gte";value:number}>};
function exactKeys(o:Record<string,unknown>, allowed:string[]) {return Object.keys(o).every(k=>allowed.includes(k));}
export function parseTypedCondition(raw:unknown):TypedCondition {
 if (!raw || typeof raw!=="object" || Array.isArray(raw)) throw Error("GOV_UNSUPPORTED_CONDITION");
 const c=raw as Record<string,unknown>;
 if(!exactKeys(c,["schemaVersion","all"])||c.schemaVersion!=="cp-condition/1"||!Array.isArray(c.all)||c.all.length>16)throw Error("GOV_UNSUPPORTED_CONDITION");
 for(const value of c.all){if(!value||typeof value!=="object"||Array.isArray(value))throw Error("GOV_UNSUPPORTED_CONDITION");const x=value as Record<string,unknown>;
  if(!exactKeys(x,["field","op","value"])||Object.keys(x).length!==3)throw Error("GOV_UNSUPPORTED_CONDITION");
  if(["kind","status","verificationLevel"].includes(String(x.field))){if(x.op!=="eq"||typeof x.value!=="string"||!x.value.length||x.value.length>80)throw Error("GOV_UNSUPPORTED_CONDITION");}
  else if(["durationMinutes","score"].includes(String(x.field))){if(x.op!=="gte"||typeof x.value!=="number"||!Number.isFinite(x.value)||x.value<0||x.value>1000000)throw Error("GOV_UNSUPPORTED_CONDITION");}
  else throw Error("GOV_UNSUPPORTED_CONDITION");
 }
 return c as unknown as TypedCondition;
}
export function matchesTypedCondition(raw:unknown,facts:QualificationFacts):boolean {
 const c=parseTypedCondition(raw);return c.all.every(x=>{const v=facts[x.field];return x.op==="eq"?v===x.value:typeof v==="number"&&Number.isFinite(v)&&v>=Number(x.value);});
}
/** Legacy rules with no condition remain unconditional; any nonempty untyped JSON fails closed. */
export function matchesLegacyRewardCondition(raw:unknown,facts:QualificationFacts) {return raw==null?true:matchesTypedCondition(raw,facts);}
