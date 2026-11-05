import { api } from './api';
import type { AxiosRequestConfig } from 'axios';
import { retryOnce } from './wellbeingRetry';
import { announceConsentChange } from './consentUpdates';

export const moodLabels = ['calm','happy','sad','anxious','angry','tired','stressed','neutral','hopeful','overwhelmed'] as const;
export type Mood = { id:string; moodLabel:string; moodScore:number|null; energyScore:number|null; note:string|null; createdAt:string };
export type Journal = { id:string; title:string|null; body:string; createdAt:string; updatedAt:string };
export type Preferences = { language:string; timezone:string; activityTypes:string[]; supportModes:string[]; accessibility:{reduceMotion?:boolean;largeText?:boolean} };
export type Consent = {purpose:string;granted:boolean};
export type Content = {id:string;title:string;description:string|null;type:string;language:string;durationSeconds:number|null;needTags:string[];imageUrl:string|null;hasAudio:boolean};
export type Activity = {id:string;status:string;contentItemId:string};
export type Page<T> = {data:T[];nextCursor:string|null};
type Envelope<T> = {data:T};

// Only safe reads and explicitly idempotent operations may be replayed.
export async function request<T>(config:AxiosRequestConfig, retrySafe=false, onRetry?:()=>void):Promise<T> {
  return retryOnce(async()=>(await api.request<T>(config)).data,retrySafe,()=>{if(onRetry)onRetry();else if(typeof window!=='undefined')window.dispatchEvent(new Event('mindhaven:service-retrying'))});
}
export const wellbeing={
 preferences:(onRetry?:()=>void)=>request<Envelope<Preferences>>({url:'/api/me/preferences'},true,onRetry),
 savePreferences:(data:Preferences,onRetry?:()=>void)=>request<Envelope<Preferences>>({url:'/api/me/preferences',method:'PUT',data},true,onRetry),
 consents:(onRetry?:()=>void)=>request<Envelope<Consent[]>>({url:'/api/me/consents'},true,onRetry),
 consent:async(purpose:'voice_processing'|'personalized_recommendations',granted:boolean,onRetry?:()=>void)=>{const result=await request<Envelope<Consent>>({url:'/api/me/consents',method:'POST',data:{purpose,granted,noticeVersion:purpose==='voice_processing'?'voice-processing-v1':'wellbeing-v1'}},true,onRetry);announceConsentChange();return result},
 moods:(params:Record<string,string>,onRetry?:()=>void)=>request<Page<Mood>>({url:'/api/me/mood-checkins',params},true,onRetry),
 addMood:(data:Record<string,unknown>,onRetry?:()=>void)=>request<Envelope<Mood>>({url:'/api/me/mood-checkins',method:'POST',data},false,onRetry),
 journals:(params:Record<string,string>,onRetry?:()=>void)=>request<Page<Journal>>({url:'/api/me/journals',params},true,onRetry),
 addJournal:(data:{title:string|null;body:string})=>request<Envelope<Journal>>({url:'/api/me/journals',method:'POST',data}),
 editJournal:(id:string,data:{title:string|null;body:string})=>request<Envelope<Journal>>({url:`/api/me/journals/${id}`,method:'PATCH',data}),
 deleteJournal:(id:string)=>request<void>({url:`/api/me/journals/${id}`,method:'DELETE'}),
 content:(params:Record<string,string>,onRetry?:()=>void)=>request<Page<Content>>({url:'/api/content',params},true,onRetry),
 item:(id:string)=>request<Envelope<Content>>({url:`/api/content/${id}`},true),
 playback:(id:string)=>request<Envelope<{url:string}>>({url:`/api/content/${id}/playback`,method:'POST',data:{}},true),
 start:(id:string)=>request<Envelope<Activity>>({url:'/api/me/activity-sessions',method:'POST',data:{contentItemId:id}}),
 finish:(id:string,status:'completed'|'abandoned')=>request<Envelope<Activity>>({url:`/api/me/activity-sessions/${id}`,method:'PATCH',data:{status}},true),
 feedback:(id:string,data:Record<string,unknown>)=>request({url:`/api/me/activity-sessions/${id}/feedback`,method:'POST',data},true),
};
export function userMessage(error:unknown){const e=error as {response?:{status?:number}};return e.response?.status===503?'Service waking up, please try again.':!e.response?'Not saved yet. Check your connection.':'Something went wrong. Please try again.'}
export const bytes=(s:string)=>new TextEncoder().encode(s).length;
export const dateRange=()=>{const now=new Date(),from=new Date(now);from.setDate(from.getDate()-30);const local=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return {from:local(from),to:local(now)}};
