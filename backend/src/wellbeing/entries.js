import { Prisma } from '@prisma/client';
﻿import { createHmac, timingSafeEqual } from 'node:crypto';
import { DateTime } from 'luxon';
class InvalidInput extends Error {}
const labels=['calm','happy','sad','anxious','angry','tired','stressed','neutral','hopeful','overwhelmed'];
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,allowed)=>object(x)&&Object.keys(x).every(k=>allowed.includes(k));
const error=(r,status,code,message)=>r.status(status).json({error:{code,message}});
const invalid=r=>error(r,400,'INVALID_REQUEST','Invalid request');
const missing=r=>error(r,404,'NOT_FOUND','Not found');
const outage=r=>{r.set('Retry-After','5');return error(r,503,'SERVICE_UNAVAILABLE','Service temporarily unavailable')};
const validId=x=>typeof x==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const score=x=>x==null||(Number.isInteger(x)&&x>=1&&x<=10);
const note=x=>x==null||(typeof x==='string'&&Buffer.byteLength(x,'utf8')<=2000);
const title=x=>x==null||(typeof x==='string'&&[...x].length<=200);
const body=x=>typeof x==='string'&&x.trim().length>0&&Buffer.byteLength(x,'utf8')<=6000;
const sign=(payload,secret)=>{let p=Buffer.from(JSON.stringify(payload)).toString('base64url');return p+'.'+createHmac('sha256',secret).update('wellbeing-cursor:').update(p).digest('base64url')};
const unpack=(raw,secret)=>{if(typeof raw!=='string'||raw.length>2048)throw Error();let [p,s,...extra]=raw.split('.');if(!p||!s||extra.length)throw Error();const mac=createHmac('sha256',secret).update('wellbeing-cursor:').update(p).digest();let supplied=Buffer.from(s,'base64url');if(supplied.length!==mac.length||!timingSafeEqual(supplied,mac))throw Error();return JSON.parse(Buffer.from(p,'base64url').toString())};
async function bounds(db,userId,q){if(typeof q.from!=='string'||typeof q.to!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(q.from)||!/^\d{4}-\d{2}-\d{2}$/.test(q.to))throw new InvalidInput();let tz=(await db.userPreference.findUnique({where:{userId},select:{timezone:true}}))?.timezone||'UTC';const start=DateTime.fromISO(q.from,{zone:tz}).startOf('day'),end=DateTime.fromISO(q.to,{zone:tz}).startOf('day');if(!start.isValid||!end.isValid||end<start||end.diff(start,'days').days>365)throw new InvalidInput();return {start:start.toUTC().toJSDate(),end:end.plus({days:1}).toUTC().toJSDate(),tz}}
const mselect={id:true,moodLabel:true,moodScore:true,energyScore:true,note:true,createdAt:true};
const jselect={id:true,title:true,body:true,origin:true,createdAt:true,updatedAt:true};
export function mountEntries(router,db,secret=process.env.API_JWT_SECRET){
 async function page(req,res,model){try{
  if(!secret)throw Error('config');if(!keys(req.query,['from','to','limit','cursor']))return invalid(res);
  if(req.query.limit!==undefined && (typeof req.query.limit!=='string'||!/^\d{1,2}$/.test(req.query.limit)))return invalid(res);const limit=req.query.limit===undefined?20:Number(req.query.limit);if(!Number.isInteger(limit)||limit<1||limit>50)return invalid(res);
  let b;try{b=await bounds(db,req.userId,req.query)}catch(e){if(e instanceof InvalidInput)return invalid(res);throw e};
  const fingerprint=[req.userId,model,req.query.from,req.query.to,b.tz].join('|');let seek=Prisma.empty;
  if(req.query.cursor){let c;try{c=unpack(req.query.cursor,secret);if(c.filter!==fingerprint||typeof c.id!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(c.time))throw Error()}catch{return invalid(res)};seek=Prisma.sql`AND (created_at,id) < (${c.time}::timestamptz,${c.id})`}
  const fields=model==='moodCheckin'?Prisma.sql`id,mood_label AS "moodLabel",mood_score AS "moodScore",energy_score AS "energyScore",note,created_at AS "createdAt"`:Prisma.sql`id,title,body,origin,created_at AS "createdAt",updated_at AS "updatedAt"`;
  const table=model==='moodCheckin'?Prisma.sql`mood_checkins`:Prisma.sql`journal_entries`;
  const origin=model==='journalEntry'?Prisma.sql`AND origin = 'user'`:Prisma.empty;
  const rows=await db.$queryRaw(Prisma.sql`SELECT ${fields},to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTime" FROM ${table} WHERE user_id=${req.userId} AND created_at>=${b.start} AND created_at<${b.end} ${origin} ${seek} ORDER BY created_at DESC,id DESC LIMIT ${limit+1}`);
  const more=rows.length>limit;if(more)rows.pop();const last=rows.at(-1);const nextCursor=more?sign({filter:fingerprint,id:last.id,time:last.cursorTime},secret):null;
  return res.json({data:rows.map(({cursorTime,...row})=>row),nextCursor});
 }catch{return outage(res)}}
 router.post('/mood-checkins',async(req,res)=>{const b=req.body;if(!keys(b,['moodLabel','moodScore','energyScore','note'])||!labels.includes(b.moodLabel)||!score(b.moodScore)||!score(b.energyScore)||!note(b.note))return invalid(res);try{const row=await db.moodCheckin.create({data:{userId:req.userId,moodLabel:b.moodLabel,moodScore:b.moodScore??null,energyScore:b.energyScore??null,note:b.note??null},select:mselect});return res.status(201).json({data:row})}catch{return outage(res)}});
 router.get('/mood-checkins',(req,res)=>page(req,res,'moodCheckin',mselect));
 router.delete('/mood-checkins/:id',async(req,res)=>{if(!validId(req.params.id))return invalid(res);try{const r=await db.moodCheckin.deleteMany({where:{id:req.params.id,userId:req.userId}});return r.count?res.sendStatus(204):missing(res)}catch{return outage(res)}});
 router.post('/journals',async(req,res)=>{const b=req.body;if(!keys(b,['title','body'])||!title(b.title)||!body(b.body))return invalid(res);try{const row=await db.journalEntry.create({data:{userId:req.userId,title:b.title??null,body:b.body,origin:'user'},select:jselect});return res.status(201).json({data:row})}catch{return outage(res)}});
 router.get('/journals',(req,res)=>page(req,res,'journalEntry',jselect,{origin:'user'}));
 router.get('/journals/:id',async(req,res)=>{if(!validId(req.params.id))return invalid(res);try{let row=await db.journalEntry.findFirst({where:{id:req.params.id,userId:req.userId,origin:'user'},select:jselect});return row?res.json({data:row}):missing(res)}catch{return outage(res)}});
 router.patch('/journals/:id',async(req,res)=>{if(!validId(req.params.id))return invalid(res);let b=req.body;if(!keys(b,['title','body'])||!Object.keys(b).length||('title'in b&&!title(b.title))||('body'in b&&!body(b.body)))return invalid(res);try{const data={updatedAt:new Date()};if('title'in b)data.title=b.title;if('body'in b)data.body=b.body;let r=await db.journalEntry.updateMany({where:{id:req.params.id,userId:req.userId,origin:'user'},data});if(!r.count)return missing(res);const row=await db.journalEntry.findFirst({where:{id:req.params.id,userId:req.userId,origin:'user'},select:jselect});return row?res.json({data:row}):missing(res)}catch{return outage(res)}});
 router.delete('/journals/:id',async(req,res)=>{if(!validId(req.params.id))return invalid(res);try{let r=await db.journalEntry.deleteMany({where:{id:req.params.id,userId:req.userId,origin:'user'}});return r.count?res.sendStatus(204):missing(res)}catch{return outage(res)}});
}
