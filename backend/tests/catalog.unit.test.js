import { test } from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import { fileURLToPath } from 'node:url';import { validateCatalog } from '../src/wellbeing/catalog.js';import { syncCatalog,assertDevelopmentTarget } from '../src/wellbeing/catalogSeed.js';import { mediaUrl,createCatalogRouter } from '../src/routes/catalogRoutes.js';import express from 'express';import request from 'supertest';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'fixtures/catalog');const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const asset=(n,p,m)=>({id:id(n),path:p,mimeType:m,sourceUrl:'https://example.invalid/source',license:'CC0',attribution:''});
const item=()=>({id:id(1),title:'Tone',description:null,type:'audio',language:'en',durationSeconds:1,needTags:['relax'],suitabilityTags:[],status:'draft',reviewVersion:'v1',audio:asset(2,'/media/audio/tone.wav','audio/wav'),image:asset(3,'/media/images/pixel.png','image/png')});
test('catalog validates fixture and rejects missing licence/source, bad files and tags',()=>{assert.equal(validateCatalog({version:1,items:[item()]},root).items.length,1);for(const change of [x=>x.audio.license='',x=>x.audio.sourceUrl='',x=>x.audio.path='/media/audio/../bad.wav',x=>x.needTags=['unknown'],x=>x.audio.path='/media/audio/missing.wav',x=>x.audio.mimeType='audio/mpeg']){let i=item();change(i);assert.throws(()=>validateCatalog({version:1,items:[i]},root))}});
test('target guard refuses production and missing flag',()=>{const e={EXPECTED_NEON_BRANCH_ID:'br-flat-scene-b3f7jcb4',DATABASE_URL:'postgresql://x@ep-shiny-fire-b3nfje3k.c-4.ap-southeast-1.aws.neon.tech/db',DIRECT_URL:'postgresql://x@ep-shiny-fire-b3nfje3k.c-4.ap-southeast-1.aws.neon.tech/db'};assert.doesNotThrow(()=>assertDevelopmentTarget(['--target=development'],e));assert.throws(()=>assertDevelopmentTarget([],e));assert.throws(()=>assertDevelopmentTarget(['--target=production'],e));assert.throws(()=>assertDevelopmentTarget(['--target=development'],{...e,DIRECT_URL:'postgresql://x@ep-cold-hill-b3lffx1r.c-4.ap-southeast-1.aws.neon.tech/db'}))});
test('seed dry run makes no writes and repeated apply is idempotent',async()=>{let content=new Map(),assets=new Map(),writes=0;const model=store=>({findUnique:async({where})=>store.get(where.id)||null,upsert:async({where,create,update})=>{writes++;store.set(where.id,store.has(where.id)?{...store.get(where.id),...update}:create)}});const db={contentItem:model(content),mediaAsset:model(assets),$transaction:async f=>f(db)};const c={items:[item()]};await syncCatalog(db,c);assert.equal(writes,0);await syncCatalog(db,c,{apply:true});assert.equal(writes,3);await syncCatalog(db,c,{apply:true});assert.equal(writes,3)});
test('URL resolver rejects non-static, non-public and unsafe paths',()=>{const asset={storageProvider:'static_web',visibility:'public',objectKey:'/media/audio/tone.wav'};assert.equal(mediaUrl(asset,'https://example.invalid/media/'),'https://example.invalid/media/audio/tone.wav');assert.equal(mediaUrl({...asset,objectKey:'/media/audio/../secret'},'https://example.invalid/media/'),null);assert.equal(mediaUrl(asset,'http://example.invalid/media/'),process.env.NODE_ENV==='development'?'http://example.invalid/media/audio/tone.wav':null);assert.equal(mediaUrl({...asset,visibility:'private'},'https://example.invalid/media/'),null)});
test('playback never accepts client origin',async()=>{const app=express();app.use(express.json());app.use((req,_res,next)=>{req.userId='user';next()});app.use('/api/content',createCatalogRouter({contentItem:{findFirst:async()=>({id:id(1),mediaAsset:{storageProvider:'static_web',visibility:'public',objectKey:'/media/audio/tone.wav'},imageAsset:null})}},{secret:'synthetic'}));const old=process.env.PUBLIC_MEDIA_BASE_URL;process.env.PUBLIC_MEDIA_BASE_URL='https://example.invalid/media/';try{let r=await request(app).post('/api/content/'+id(1)+'/playback').send({url:'https://attacker.invalid'});assert.equal(r.status,400);r=await request(app).post('/api/content/'+id(1)+'/playback').send({});assert.equal(r.body.data.url,'https://example.invalid/media/audio/tone.wav')}finally{if(old===undefined)delete process.env.PUBLIC_MEDIA_BASE_URL;else process.env.PUBLIC_MEDIA_BASE_URL=old}});

// Pure environment checks avoid mutating global NODE_ENV used by other tests.
import { validMediaBaseUrl, assertMediaBaseUrl } from '../src/wellbeing/mediaBaseUrl.js';
test('HTTP public media is development-only and refused at production startup',()=>{
 const base='http://192.168.1.20:3001/media/';
 assert.equal(validMediaBaseUrl(base,'development'),true);
 for(const mode of ['production','test',null,'Development','']) {
  assert.equal(validMediaBaseUrl(base,mode),false);
  assert.throws(()=>assertMediaBaseUrl({PUBLIC_MEDIA_BASE_URL:base,NODE_ENV:mode}),/development-only/);
 }
 assert.doesNotThrow(()=>assertMediaBaseUrl({PUBLIC_MEDIA_BASE_URL:base,NODE_ENV:'development'}));
 assert.doesNotThrow(()=>assertMediaBaseUrl({PUBLIC_MEDIA_BASE_URL:'https://site.invalid/media/',NODE_ENV:'production'}));
 for(const value of ['http://user:pass@host/media/','http://host/','http://host/media/?q=1','http://host/media/#x'])
  assert.equal(validMediaBaseUrl(value,'development'),false);
});
test('HTTP media guard: unset NODE_ENV refuses even when this process runs as development; startup wiring is in place',()=>{
 const base='http://192.168.1.20:3001/media/',saved=process.env.NODE_ENV;
 try{process.env.NODE_ENV='development';
  assert.throws(()=>assertMediaBaseUrl({PUBLIC_MEDIA_BASE_URL:base}),/development-only/);
  assert.throws(()=>assertMediaBaseUrl({PUBLIC_MEDIA_BASE_URL:base,NODE_ENV:undefined}),/development-only/);
  assert.equal(mediaUrl({storageProvider:'static_web',visibility:'public',objectKey:'/media/audio/tone.wav'},base),'http://192.168.1.20:3001/media/audio/tone.wav');
  process.env.NODE_ENV='production';
  assert.equal(mediaUrl({storageProvider:'static_web',visibility:'public',objectKey:'/media/audio/tone.wav'},base),null,'runtime resolver also refuses http outside development');
 }finally{if(saved===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=saved}
 // server.js must validate after loading .env and before building the app.
 const src=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const load=src.indexOf('dotenv.config();'),check=src.indexOf('assertMediaBaseUrl();'),build=src.indexOf('const app = express();');
 assert.ok(load>=0&&check>load&&build>check,'assertMediaBaseUrl() runs at startup after dotenv.config()');
});
import fs from 'node:fs';
