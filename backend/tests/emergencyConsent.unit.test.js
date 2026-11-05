import { test } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import express from 'express';
import request from 'supertest';
import emergencyRoutes from '../src/routes/emergencyRoutes.js';
import { createOrUpdateEmergencyContact, setEmergencyContactNotifications, getEmergencyContact, deleteEmergencyContact } from '../src/storage-service/index.js';

test('contact defaults, replacement and opt-in record consent; opt-out and deletion persist',async()=>{
  const originalTransaction=prisma.$transaction, originalContact=prisma.emergencyContact;
  let row=null;const consents=[];
  const contact={findUnique:async()=>row,upsert:async({create,update})=>{row=row?{...row,...update}:{id:'contact',notifyEnabled:true,...create};return row},update:async({data})=>(row={...row,...data}),deleteMany:async()=>{row=null;return {count:1}}};
  const tx={emergencyContact:contact,userConsent:{findFirst:async()=>consents.at(-1)||null},$queryRaw:async(strings,...values)=>{if(!strings[0].includes('INSERT'))return [];const row={purpose:values[1],noticeVersion:values[2],granted:values[3],recordedAt:new Date()};consents.push(row);return [row]}};
  prisma.$transaction=async fn=>fn(tx);Object.defineProperty(prisma,'emergencyContact',{configurable:true,value:contact});
  try {
    let result=await createOrUpdateEmergencyContact('unit-user','Test','one.invalid',null);assert.equal(result.notify_enabled,true);assert.equal(consents.length,1);assert.equal(consents[0].purpose,'emergency_alert_sharing');assert.equal(consents[0].noticeVersion,'emergency-alert-v1');
    result=await setEmergencyContactNotifications('unit-user',false);assert.equal(result.notify_enabled,false);
    result=await getEmergencyContact('unit-user');assert.equal(result.notify_enabled,false);
    result=await setEmergencyContactNotifications('unit-user',true);assert.equal(result.notify_enabled,true);assert.equal(consents.length,3);
    await setEmergencyContactNotifications('unit-user',false);
    result=await createOrUpdateEmergencyContact('unit-user','Test','two.invalid',null);assert.equal(result.notify_enabled,true);assert.equal(consents.length,5);
    await deleteEmergencyContact('unit-user');assert.equal(await getEmergencyContact('unit-user'),null);assert.equal(consents.at(-1).granted,false);
  } finally {prisma.$transaction=originalTransaction;Object.defineProperty(prisma,'emergencyContact',{configurable:true,value:originalContact});}
});

test('notification endpoint updates the authenticated contact and rejects non-boolean input',async()=>{
  const original=prisma.$transaction;
  let row={id:'contact',userId:'unit-user',notifyEnabled:true};
  const tx={emergencyContact:{findUnique:async()=>row,update:async({data})=>(row={...row,...data})},userConsent:{findFirst:async()=>null},$queryRaw:async(strings,...values)=>strings[0].includes('INSERT')?[{purpose:values[1],noticeVersion:values[2],granted:values[3],recordedAt:new Date()}]:[]};
  prisma.$transaction=async fn=>fn(tx);
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.userId='unit-user';next()});app.use('/api/emergency',emergencyRoutes);
  try {
    let response=await request(app).put('/api/emergency/notifications').send({notifyEnabled:false});assert.equal(response.status,200);assert.equal(response.body.data.notify_enabled,false);
    response=await request(app).put('/api/emergency/notifications').send({notifyEnabled:'false'});assert.equal(response.status,400);
  } finally {prisma.$transaction=original;}
});
