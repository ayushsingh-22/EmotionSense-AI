export const NOTICE_VERSIONS = Object.freeze({ emergency_alert_sharing:'emergency-alert-v1', personalized_recommendations:'wellbeing-v1', voice_processing:'voice-processing-v1' });
export async function lockConsent(tx, userId, purpose) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`consent:${userId}:${purpose}`}, 0))::text`;
}
export async function currentConsent(db, userId, purpose) {
  return db.userConsent.findFirst({where:{userId,purpose},orderBy:[{recordedAt:'desc'},{id:'desc'}],select:{purpose:true,granted:true,noticeVersion:true,recordedAt:true}});
}
export async function appendConsentLocked(tx, userId, purpose, granted, noticeVersion=NOTICE_VERSIONS[purpose]) {
  const rows=await tx.$queryRaw`INSERT INTO user_consents (id,user_id,purpose,notice_version,granted,source,recorded_at)
    SELECT gen_random_uuid()::text, ${userId}, ${purpose}, ${noticeVersion}, ${granted}, 'in_app',
    GREATEST(clock_timestamp(), COALESCE(MAX(recorded_at) + interval '1 microsecond', clock_timestamp()))
    FROM user_consents WHERE user_id=${userId} AND purpose=${purpose}
    RETURNING purpose,granted,notice_version AS "noticeVersion",recorded_at AS "recordedAt"`;
  return rows[0];
}
export async function changeConsent(tx, userId, purpose, granted, noticeVersion=NOTICE_VERSIONS[purpose]) {
  await lockConsent(tx,userId,purpose);
  const current=await currentConsent(tx,userId,purpose);
  if(current && current.granted===granted && current.noticeVersion===noticeVersion)return {row:current,changed:false};
  return {row:await appendConsentLocked(tx,userId,purpose,granted,noticeVersion),changed:true};
}
