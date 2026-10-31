import safeLog from '../utils/logger.js';
import express from 'express';
import rateLimit from 'express-rate-limit';

// Dependencies are injected so automated tests can substitute a fake email adapter.
export function createBackendAuthRouter({ prisma, services }) {
  const { passwords, tokens, sessions, challenges, email, transactionOptions = { maxWait: 10000, timeout: 15000 } } = services;
  const router = express.Router();
  const limiter = (limit, windowMs) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Please try again later' } });
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next()});
  router.use(limiter(100, 15 * 60 * 1000));
  router.use('/login', limiter(10, 15 * 60 * 1000));
  router.use('/register', limiter(10, 60 * 60 * 1000));
  router.use(['/verify-email', '/resend-verification', '/forgot-password', '/reset-password'], limiter(10, 60 * 60 * 1000));
  const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
  const goodEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const ack = async (res, started, delivery) => {
    const remaining = 1500 - (Date.now() - started);
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    if (delivery) res.once('finish', () => setImmediate(async () => {
      let timer;
      try {
        if (email.handlesRetries) await email.send(delivery);
        else await Promise.race([email.send(delivery), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 10000); timer.unref(); })]);
      } catch { safeLog.error('Auth email delivery failed'); }
      finally { clearTimeout(timer); }
    }));
    return res.status(202).json({ message: 'If eligible, instructions will be sent.' });
  };
  const invalid = res => res.status(401).json({ success: false, error: 'Invalid credentials or session', code: 'UNAUTHENTICATED' });
  const logDependencyError = error => { const code = typeof error?.code === 'string' && /^P\d{4}$/.test(error.code) ? error.code : 'unclassified'; safeLog.error({ code }); };
  const unavailable = (res,error) => { logDependencyError(error); if (['P2028','P2024','P1001','P1008'].includes(error?.code)) res.set('Retry-After','3'); return res.status(503).json({error:'Service temporarily unavailable'}); };
  const fail = fn => async(req,res) => { try { await fn(req,res); } catch (error) { if (!res.headersSent) unavailable(res,error); } };
  async function challenge(user,purpose) {
    const result=await challenges.issue({userId:user.id,purpose});
    return result ? {to:user.email,subject:'Verification code',text:`Your code is ${result.code}. It expires in 10 minutes.`} : null;
  }
  async function userFor(req) {
    const address=normalize(req.body?.email);
    return goodEmail(address) ? prisma.user.findUnique({where:{email:address}}) : null;
  }
  async function auth(req,res,next) {
    const header=req.get('authorization')||'';
    if(!header.startsWith('Bearer ')) return invalid(res);
    let claims;
    try { claims=await tokens.verify(header.slice(7)); } catch { return invalid(res); }
    try {
      if(!await sessions.markUsed({userId:claims.sub,sessionId:claims.sid})) return invalid(res);
      req.userId=claims.sub; req.sessionId=claims.sid; req.user={id:claims.sub,role:'user'}; next();
    } catch (error) { unavailable(res,error); }
  }
  async function logoutAuth(req,res,next) {
    const header=req.get('authorization')||'';
    if(!header.startsWith('Bearer ')) return invalid(res);
    try { const claims=await tokens.verify(header.slice(7)); req.userId=claims.sub; req.sessionId=claims.sid; next(); }
    catch { return invalid(res); }
  }
  router.post('/register',fail(async(req,res)=>{
    const started=Date.now();
    const address=normalize(req.body?.email), password=req.body?.password;
    if(!goodEmail(address)) return res.status(400).json({error:'Invalid request'});
    try { passwords.validate(password); } catch { return res.status(400).json({error:'Invalid request'}); }
    const passwordHash=await passwords.hash(password);
    let user;
    try { user=await prisma.user.create({data:{email:address,passwordHash,fullName:typeof req.body?.name==='string'?req.body.name.slice(0,100):null}}); }
    catch(e) { if(e.code!=='P2002') throw e; user=await prisma.user.findUnique({where:{email:address}}); }
    const delivery=user&&!user.emailVerifiedAt ? await challenge(user,'verify_email') : null;
    return ack(res,started,delivery);
  }));
  router.post('/resend-verification',fail(async(req,res)=>{const started=Date.now(), user=await userFor(req); const delivery=user&&!user.emailVerifiedAt ? await challenge(user,'verify_email') : null;return ack(res,started,delivery)}));
  router.post('/forgot-password',fail(async(req,res)=>{const started=Date.now(), user=await userFor(req);const delivery=user?.emailVerifiedAt ? await challenge(user,'reset_password') : null;return ack(res,started,delivery)}));
  router.post('/verify-email',fail(async(req,res)=>{
    const user=await userFor(req); const ok=user && await challenges.consume({userId:user.id,purpose:'verify_email',code:req.body?.otp},async(tx,now)=>tx.user.update({where:{id:user.id},data:{emailVerifiedAt:now}}));
    return ok?res.json({success:true}):res.status(400).json({error:'Invalid or expired code'});
  }));
  router.post('/login',fail(async(req,res)=>{
    const user=await userFor(req), password=req.body?.password;
    const checked=await passwords.verify(password,user?.passwordHash);
    if(!user || !checked.valid) return invalid(res);
    if(!user.emailVerifiedAt) return res.status(403).json({error:'Email verification required'});
    let currentHash=user.passwordHash;
    if(checked.needsRehash){const hash=await passwords.hash(password);const changed=await prisma.user.updateMany({where:{id:user.id,passwordHash:user.passwordHash},data:{passwordHash:hash}});if(changed.count!==1)return invalid(res);currentHash=hash}
    const pair=await sessions.create({userId:user.id,expectedPasswordHash:currentHash,deviceLabel:typeof req.body?.deviceLabel==='string'?req.body.deviceLabel.slice(0,100):null});
    return pair?res.json({...pair,user:{id:user.id,name:user.fullName}}):invalid(res);
  }));
  router.post('/refresh',fail(async(req,res)=>{const pair=await sessions.rotate(req.body?.refreshToken);return pair?res.json(pair):invalid(res)}));
  router.post('/logout',logoutAuth,fail(async(req,res)=>{const ok=await sessions.logout({userId:req.userId,sessionId:req.sessionId});return ok?res.json({success:true}):invalid(res)}));
  router.post('/logout-all',auth,fail(async(req,res)=>{await sessions.logoutAll(req.userId);res.json({success:true})}));
  router.get('/me',auth,fail(async(req,res)=>{const user=await prisma.user.findUnique({where:{id:req.userId},select:{id:true,fullName:true,emailVerifiedAt:true}});return user?res.json({user}):invalid(res)}));
  router.post('/reset-password',fail(async(req,res)=>{
    const user=await userFor(req), password=req.body?.password;
    try { passwords.validate(password); } catch { return res.status(400).json({error:'Invalid request'}); }
    const hash=await passwords.hash(password);
    const ok=user && await challenges.consume({userId:user.id,purpose:'reset_password',code:req.body?.otp},async(tx,now)=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-user:${user.id}`}, 0))::text AS locked`;
      await tx.user.update({where:{id:user.id},data:{passwordHash:hash}});
      await tx.authSession.updateMany({where:{userId:user.id},data:{revokedAt:now,replayCiphertext:null,replayExpiresAt:null}});
    });
    return ok?res.json({success:true}):res.status(400).json({error:'Invalid or expired code'});
  }));
  router.post('/change-password',auth,fail(async(req,res)=>{
    const user=await prisma.user.findUnique({where:{id:req.userId}});
    if(!(await passwords.verify(req.body?.currentPassword,user?.passwordHash)).valid) return invalid(res);
    try { passwords.validate(req.body?.newPassword); } catch { return res.status(400).json({error:'Invalid request'}); }
    const hash=await passwords.hash(req.body.newPassword);
    const changed=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-user:${req.userId}`}, 0))::text AS locked`;const updated=await tx.user.updateMany({where:{id:req.userId,passwordHash:user.passwordHash},data:{passwordHash:hash}});if(!updated.count)return false;await tx.authSession.updateMany({where:{userId:req.userId},data:{revokedAt:new Date(),replayCiphertext:null,replayExpiresAt:null}});return true},transactionOptions);
    return changed?res.json({success:true}):invalid(res);
  }));
  router.delete('/account',auth,fail(async(req,res)=>{
    const user=await prisma.user.findUnique({where:{id:req.userId}});
    if(!(await passwords.verify(req.body?.password,user?.passwordHash)).valid) return invalid(res);
    const deleted=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-user:${req.userId}`}, 0))::text AS locked`;return tx.user.deleteMany({where:{id:req.userId,passwordHash:user.passwordHash}})},transactionOptions);
    return deleted.count?res.json({success:true}):invalid(res);
  }));
  return {router,auth};
}
