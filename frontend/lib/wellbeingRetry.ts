export async function retryOnce<T>(operation:()=>Promise<T>,safe:boolean,onRetry?:()=>void,wait:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))):Promise<T>{
 try{return await operation()}catch(error){if(!safe||(error as {response?:{status?:number}}).response?.status!==503)throw error;onRetry?.();await wait(1500);return operation()}
}
