const reserved = host => {
 const name=host.toLowerCase().replace(/\.$/,'');
 return ['invalid','test','example','localhost','example.com','example.net','example.org'].some(x=>name===x||name.endsWith('.'+x));
};
export function productionCatalogIssues(catalog){
 if(!catalog||!Array.isArray(catalog.items))throw Error('Invalid catalog');
 const issues=[];
 for(const item of catalog.items){
  const reasons=[];
  for(const kind of ['audio','image']){
   const asset=item[kind];let url;
   try{url=new URL(asset?.sourceUrl)}catch{reasons.push(`${kind}: invalid source`);continue}
   if(!['https:'].includes(url.protocol)||reserved(url.hostname))reasons.push(`${kind}: reserved or invalid source`);
   if(typeof asset.license!=='string'||!asset.license.trim()||/testing\s+only/i.test(asset.license))reasons.push(`${kind}: testing-only or missing licence`);
  }
  if(reasons.length)issues.push({id:typeof item.id==='string'?item.id:'unknown',title:typeof item.title==='string'?item.title:'untitled',reasons});
 }
 return issues;
}
export function assertProductionCatalog(catalog){
 const issues=productionCatalogIssues(catalog);if(issues.length)throw Error('Production catalog contains test-only items:\n'+issues.map(x=>`- ${x.title} (${x.id}): ${x.reasons.join(', ')}`).join('\n'));
}
