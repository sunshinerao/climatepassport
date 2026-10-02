import {NextRequest,NextResponse} from 'next/server';
import {requireApiUser} from '@/lib/server/api-auth';
import {getPrismaClient} from '@/lib/server/prisma';
import {executeGovernance,readGovernance,GovernanceError} from '@/lib/server/governance';
import {listGovernanceProjects} from '@/lib/server/governance-projects';
export const dynamic='force-dynamic';
function failure(error:unknown){if(error instanceof GovernanceError)return NextResponse.json({error:error.code,code:error.code},{status:error.status});return NextResponse.json({error:'Governance operation failed',code:'GOV_INTERNAL_ERROR'},{status:500});}
export async function GET(request:NextRequest){const actor=await requireApiUser(request);if(actor instanceof NextResponse)return actor;const prisma=getPrismaClient();if(!prisma)return NextResponse.json({code:'GOV_UNAVAILABLE'},{status:503});const id=request.nextUrl.searchParams.get('projectId');if(id&&!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({code:'GOV_INVALID_REQUEST'},{status:400});try{return NextResponse.json(id?await readGovernance(prisma,actor.id,id):await listGovernanceProjects(prisma,actor.id));}catch(e){return failure(e);}}
export async function POST(request:NextRequest){
 const actor=await requireApiUser(request);if(actor instanceof NextResponse)return actor;
 const origin=request.headers.get('origin');if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({code:'GOV_ORIGIN_DENIED'},{status:403});
 const prisma=getPrismaClient();if(!prisma)return NextResponse.json({code:'GOV_UNAVAILABLE'},{status:503});
 try{const reader=request.body?.getReader();if(!reader)return NextResponse.json({code:'GOV_INVALID_REQUEST'},{status:400});let size=0;const chunks:Uint8Array[]=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();return NextResponse.json({code:'GOV_BODY_TOO_LARGE'},{status:413});}chunks.push(value);}let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return NextResponse.json({code:'GOV_INVALID_REQUEST'},{status:400});}return NextResponse.json(await executeGovernance(prisma,actor.id,body));}catch(e){return failure(e);}
}
