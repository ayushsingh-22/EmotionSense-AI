export function createSseWriter(res){
 let closed=false;
 res.on('close',()=>{closed=true});
 res.on('error',()=>{closed=true});
 return {
  send(event,data){if(closed||res.destroyed||res.writableEnded)return false;try{res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);return true}catch{closed=true;return false}},
  end(){if(!closed&&!res.destroyed&&!res.writableEnded){try{res.end()}catch{closed=true}}},
  isClosed:()=>closed||res.destroyed||res.writableEnded
 };
}
