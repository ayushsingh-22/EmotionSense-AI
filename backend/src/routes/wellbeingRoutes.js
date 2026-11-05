import { mountEntries } from '../wellbeing/entries.js';
import { mountActivity } from '../wellbeing/activity.js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { NOTICE_VERSIONS, currentConsent, changeConsent } from '../wellbeing/consents.js';
const fail=(res,status,code,message)=>res.status(status).json({error:{code,message}});
const invalid=res=>fail(res,400,'INVALID_REQUEST','Invalid request');
const unavailable=res=>{res.set('Retry-After','5');return fail(res,503,'SERVICE_UNAVAILABLE','Service temporarily unavailable')};
const validObject=o=>o && typeof o==='object' && !Array.isArray(o);
const exact=(o,keys)=>validObject(o)&&Object.keys(o).every(k=>keys.includes(k));
const list=(x,allowed)=>Array.isArray(x)&&x.length<=10&&new Set(x).size===x.length&&x.every(v=>typeof v==='string'&&allowed.includes(v));
function validPreference(x){
 if(!exact(x,['language','timezone','activityTypes','supportModes','accessibility'])||Object.keys(x).length!==5)return false;
 if(typeof x.language!=='string'||x.language.length<2||x.language.length>35||! /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(x.language))return false;
 try{new Intl.DateTimeFormat('en',{timeZone:x.timezone}).format()}catch{return false}
 if(typeof x.timezone!=='string'||!list(x.activityTypes,['audio','breathing','meditation','sleep'])||!list(x.supportModes,['self_guided','conversation']))return false;
 return exact(x.accessibility,['reduceMotion','largeText'])&&Object.values(x.accessibility).every(v=>typeof v==='boolean');
}
const shape=p=>({language:p?.preferredLanguage??'en',timezone:p?.timezone??'UTC',activityTypes:p?.preferredActivityTypes??[],supportModes:p?.preferredSupportModes??[],accessibility:p?.accessibilityPreferences??{}});
const view=(purpose,row)=>({purpose,granted:row?.granted??false,noticeVersion:row?.noticeVersion??null,recordedAt:row?.recordedAt??null});
export function createWellbeingRouter(db){
 const router=express.Router();
 const limiter=(limit,skip)=>rateLimit({windowMs:60000,limit,standardHeaders:true,legacyHeaders:false,keyGenerator:req=>req.userId,skip,handler:(_req,res)=>{res.set('Retry-After','60');fail(res,429,'RATE_LIMITED','Too many requests')}});
 const ipLimit=(limit,skip)=>rateLimit({windowMs:60000,limit,standardHeaders:true,legacyHeaders:false,skip,handler:(_req,res)=>{res.set('Retry-After','60');fail(res,429,'RATE_LIMITED','Too many requests')}});
 router.use(ipLimit(120,req=>req.method!=='GET'),ipLimit(30,req=>req.method==='GET'),limiter(120,req=>req.method!=='GET'),limiter(30,req=>req.method==='GET'));
 router.get('/preferences',async(req,res)=>{try{const p=await db.userPreference.findUnique({where:{userId:req.userId},select:{preferredLanguage:true,timezone:true,preferredActivityTypes:true,preferredSupportModes:true,accessibilityPreferences:true}});return res.json({data:shape(p)})}catch{return unavailable(res)}});
 router.put('/preferences',async(req,res)=>{if(!validPreference(req.body))return invalid(res);const b=req.body;try{const data={preferredLanguage:b.language,timezone:b.timezone,preferredActivityTypes:b.activityTypes,preferredSupportModes:b.supportModes,accessibilityPreferences:b.accessibility,updatedAt:new Date()};const p=await db.userPreference.upsert({where:{userId:req.userId},create:{userId:req.userId,...data},update:data,select:{preferredLanguage:true,timezone:true,preferredActivityTypes:true,preferredSupportModes:true,accessibilityPreferences:true}});return res.json({data:shape(p)})}catch{return unavailable(res)}});
 router.get('/consents',async(req,res)=>{try{const data=[];for(const purpose of Object.keys(NOTICE_VERSIONS))data.push(view(purpose,await currentConsent(db,req.userId,purpose)));return res.json({data})}catch{return unavailable(res)}});
 router.post('/consents',async(req,res)=>{const b=req.body;if(!exact(b,['purpose','granted','noticeVersion'])||typeof b.purpose!=='string'||!Object.hasOwn(NOTICE_VERSIONS,b.purpose)||typeof b.granted!=='boolean'||b.noticeVersion!==NOTICE_VERSIONS[b.purpose])return invalid(res);
  try{const result=await db.$transaction(async tx=>{if(b.purpose==='emergency_alert_sharing'){await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`emergency-contact:${req.userId}`}, 0))::text`;const contact=await tx.emergencyContact.findUnique({where:{userId:req.userId},select:{notifyEnabled:true}});if(b.granted&&!contact)return null;if(contact)await tx.emergencyContact.update({where:{userId:req.userId},data:{notifyEnabled:b.granted}})}return changeConsent(tx,req.userId,b.purpose,b.granted,b.noticeVersion)});if(!result)return invalid(res);return res.status(result.changed?201:200).json({data:view(b.purpose,result.row)})}catch{return unavailable(res)} });
 mountEntries(router,db);
 mountActivity(router,db);
 return router;
}
export function requireVoiceConsent(db){return async(req,res,next)=>{try{const row=await currentConsent(db,req.userId,'voice_processing');if(!row?.granted)return fail(res,403,'CONSENT_REQUIRED','Consent required');return next()}catch{return unavailable(res)}}}
