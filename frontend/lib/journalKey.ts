export function journalKey(journal:{id?:string|null;date:string;kind?:'written'|'generated';origin?:string}):string{
 const kind=journal.kind??(journal.origin==='user'?'written':'generated');
 return `${kind}-${journal.id||journal.date}`;
}
