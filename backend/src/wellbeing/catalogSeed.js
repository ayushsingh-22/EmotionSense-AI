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
export function assertDevelopmentTarget(args,env){
 if(!args.includes('--target=development')||args.some(x=>!['--target=development','--apply'].includes(x)))throw Error('Use --target=development [--apply]; production is not enabled');
 if(env.EXPECTED_NEON_BRANCH_ID!=='br-flat-scene-b3f7jcb4')throw Error('Unapproved branch');
 for(const key of ['DATABASE_URL','DIRECT_URL']){let host;try{host=new URL(env[key]).hostname}catch{throw Error('Invalid target')}if(host.split('.')[0].replace(/-pooler$/,'')!=='ep-shiny-fire-b3nfje3k'||!host.endsWith('.aws.neon.tech'))throw Error('Unapproved endpoint')}
}
