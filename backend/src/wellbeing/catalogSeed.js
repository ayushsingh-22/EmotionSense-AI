export async function syncCatalog(db,catalog,{apply=false,report=()=>{}}={}) {
 for(const item of catalog.items){
  const wanted={id:item.id,title:item.title,description:item.description,contentType:item.type,language:item.language,durationSeconds:item.durationSeconds,needTags:item.needTags,suitabilityTags:item.suitabilityTags,status:item.status,reviewVersion:item.reviewVersion,mediaAssetId:item.audio.id,imageAssetId:item.image.id};
  const old=await db.contentItem.findUnique({where:{id:item.id},select:Object.fromEntries(Object.keys(wanted).map(k=>[k,true]))});
  const changed=old?Object.keys(wanted).filter(k=>JSON.stringify(old[k])!==JSON.stringify(wanted[k])):Object.keys(wanted);
  report(`${old?(changed.length?'UPDATE':'UNCHANGED'):'CREATE'} content ${item.id}: ${changed.join(',')||'no changes'}`);
  const assets=[];
  for(const [kind,a] of [['audio',item.audio],['image',item.image]]){
   const data={storageProvider:'static_web',objectKey:a.path,mimeType:a.mimeType,visibility:'public',licenseNote:[a.sourceUrl,a.license,a.attribution].filter(Boolean).join(' | '),durationSeconds:kind==='audio'?item.durationSeconds:null};
   const prior=await db.mediaAsset.findUnique({where:{id:a.id},select:Object.fromEntries(Object.keys(data).map(k=>[k,true]))});
   const fields=prior?Object.keys(data).filter(k=>JSON.stringify(prior[k])!==JSON.stringify(data[k])):Object.keys(data);
   assets.push({a,data,fields});report(`${prior?(fields.length?'UPDATE':'UNCHANGED'):'CREATE'} asset ${a.id}: ${fields.join(',')||'no changes'}`);
  }
  if(!apply||(!changed.length&&assets.every(a=>!a.fields.length)))continue;
  await db.$transaction(async tx=>{for(const {a,data,fields} of assets){if(fields.length)await tx.mediaAsset.upsert({where:{id:a.id},create:{id:a.id,...data},update:data})}if(changed.length){const {id,...fields}=wanted;await tx.contentItem.upsert({where:{id},create:{id,...fields},update:{...fields,updatedAt:new Date()}})}});
 }
 return {items:catalog.items.length,applied:apply};
}
export const DEVELOPMENT_DB = Object.freeze({ branch: 'br-flat-scene-b3f7jcb4', endpoint: 'ep-shiny-fire-b3nfje3k', project: 'fancy-union-28873755' });
export const PRODUCTION_DB = Object.freeze({ branch: 'br-ancient-snow-b3si0kwz', endpoint: 'ep-cold-hill-b3lffx1r', project: 'fancy-union-28873755' });

/**
 * Parse seed-catalog.mjs arguments.
 *   development: --target=development [--apply]
 *   production:  --target=production --approve-production --env-file=PATH [--apply]
 * Dry run unless --apply. Anything else is refused.
 */
export function parseSeedArgs(args){
 const flags=new Set(args.filter(a=>!a.startsWith('--env-file=')));
 const envFiles=args.filter(a=>a.startsWith('--env-file='));
 const allowed=['--target=development','--target=production','--approve-production','--apply'];
 if([...flags].some(a=>!allowed.includes(a))||flags.size+envFiles.length!==args.length||envFiles.length>1)throw Error('Unknown or repeated argument');
 const targets=['--target=development','--target=production'].filter(t=>flags.has(t));
 if(targets.length!==1)throw Error('Choose exactly one of --target=development or --target=production');
 const apply=flags.has('--apply');
 if(targets[0]==='--target=development'){
  if(flags.has('--approve-production')||envFiles.length)throw Error('--approve-production and --env-file are production-only');
  return {target:'development',apply};
 }
 if(!flags.has('--approve-production'))throw Error('Production requires --approve-production');
 const envFile=envFiles[0]?.slice('--env-file='.length);
 if(!envFile)throw Error('Production requires --env-file=PATH with the production database settings');
 if(/(^|[\\/])\.env\.test$/.test(envFile))throw Error('The test env file can never be a production target');
 return {target:'production',apply,envFile};
}

const endpointOf=value=>{let host;try{host=new URL(value).hostname}catch{throw Error('Invalid database URL')}if(!host.endsWith('.aws.neon.tech'))throw Error('Unapproved database host');return host.split('.')[0].replace(/-pooler$/,'')};

/** Static checks of the production env before any network or database access. */
export function assertProductionTarget(env,{validMediaBase}){
 if(env.EXPECTED_NEON_BRANCH_ID!==PRODUCTION_DB.branch)throw Error('EXPECTED_NEON_BRANCH_ID is not the production branch');
 for(const key of ['DATABASE_URL','DIRECT_URL'])if(endpointOf(env[key])!==PRODUCTION_DB.endpoint)throw Error(`${key} is not the production endpoint`);
 const pooled=new URL(env.DATABASE_URL),direct=new URL(env.DIRECT_URL);
 if(direct.hostname.includes('-pooler')||pooled.hostname.replace('-pooler.','.')!==direct.hostname||pooled.pathname!==direct.pathname)throw Error('Pooled and direct production URLs do not match');
 // Production media must be HTTPS; the development-only http exception never applies here.
 if(!env.PUBLIC_MEDIA_BASE_URL||!validMediaBase(env.PUBLIC_MEDIA_BASE_URL,'production'))throw Error('PUBLIC_MEDIA_BASE_URL must be the HTTPS site media origin ending in /media/');
}

/** Compare a live database identity with the expected branch/endpoint. */
export function assertDatabaseIdentity(identity,expected){
 if(identity?.branch!==expected.branch||identity?.endpoint!==expected.endpoint||(expected.project&&identity?.project!==expected.project))throw Error('Database identity does not match the approved target');
}

/**
 * HEAD every audio/image file of `items` at the live media origin. A file
 * counts as deployed only with 200 (redirects are not followed), the expected
 * Content-Type and, when sent, the same Content-Length as the local file.
 * Returns a list of problems; empty means everything is deployed.
 */
export async function checkDeployedMedia(items,baseUrl,{fetchImpl=fetch,localSize,timeoutMs=10000}={}){
 const problems=[];const seen=new Set();
 for(const item of items)for(const kind of ['audio','image']){
  const asset=item[kind];if(seen.has(asset.path))continue;seen.add(asset.path);
  const url=new URL(asset.path.slice('/media/'.length),baseUrl).href;
  let response;
  try{response=await fetchImpl(url,{method:'HEAD',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)})}
  catch{problems.push(`${asset.path}: not reachable`);continue}
  if(response.status!==200){problems.push(`${asset.path}: HTTP ${response.status}`);continue}
  const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(type!==asset.mimeType.toLowerCase())problems.push(`${asset.path}: Content-Type ${type||'missing'} (expected ${asset.mimeType})`);
  const length=response.headers.get('content-length');
  const expected=localSize?.(asset.path);
  if(length!=null&&expected!=null&&Number(length)!==expected)problems.push(`${asset.path}: deployed size ${length} differs from local ${expected}`);
 }
 return problems;
}
export function assertDevelopmentTarget(args,env){
 if(!args.includes('--target=development')||args.some(x=>!['--target=development','--apply'].includes(x)))throw Error('Use --target=development [--apply]; production is not enabled');
 if(env.EXPECTED_NEON_BRANCH_ID!=='br-flat-scene-b3f7jcb4')throw Error('Unapproved branch');
 for(const key of ['DATABASE_URL','DIRECT_URL']){let host;try{host=new URL(env[key]).hostname}catch{throw Error('Invalid target')}if(host.split('.')[0].replace(/-pooler$/,'')!=='ep-shiny-fire-b3nfje3k'||!host.endsWith('.aws.neon.tech'))throw Error('Unapproved endpoint')}
}
