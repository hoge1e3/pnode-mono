import { ObjectEntry } from './objects.js';
import { asHash, BranchName, APIConfig, Hash, PHPTimestamp } from './types.js';
import { dateToPhpTimestamp, phpTimestampToDate, toBase64 } from './util.js';

export interface WebApiFactory<I,C,W extends WebApi<C>>{
  init(initializer:I): Promise<W>;
  load(config:C): Promise<W>;
}
const sym_spki=Symbol("SubjectPublicKeyInfo");
const sym_sign=Symbol("sign");
export type SubjectPublicKeyInfo=string&{[sym_spki]:true};
export type Signature=string&{[sym_sign]:true};
export interface Timeline{
  time:Date;
  hash:Hash;
  public_key: SubjectPublicKeyInfo;
  signature: Signature;
}
export interface WebApi<C> {
  config: C;
  //createRepository(): Promise<{ repo_id: string }>;
  //setHead(branch: BranchName, current:Hash, next: Hash): Promise<void>;
  //addHead(branch: BranchName, next: Hash): Promise<void>;
  //hasHead(branch: BranchName): Promise<boolean>;
  //getHead(branch: BranchName): Promise<Hash|null>;
  uploadObjects(objects: ObjectEntry[]): Promise<Date>;
  //downloadSince(since?: Date): Promise<{objects:ObjectEntry[],newest:Date}>;
  downloadObjects(hashList: Hash[]): Promise<ObjectEntry[]>;
  getTimeLine(after:Date,before: Date):Promise<Timeline[]>;
  commit(t:Timeline):Promise<void>;
}
type Actions=/*"create"|*/"upload"|"download"|"get_timeline"|"commit";//get_head"|"set_head";
type StringifiedObject={ hash: Hash; content: string, mtime?:PHPTimestamp };
export class PHPClientFactory implements WebApiFactory<string, APIConfig, PHPClient>{
  async init(serverUrl:string) {
    return new PHPClient(serverUrl/*, repoId,*/ keyPair);
  }
  async load({serverUrl/*, repoId, apiKey*/, keyPair}: APIConfig): Promise<PHPClient> {
    return new PHPClient(serverUrl/*, repoId,*/ keyPair);
  }
}
async function post(serverUrl:string,action: Actions, data: any) {
  const response = await fetch(`${serverUrl}?action=${action}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (response.status !== 200) {
    throw new Error(await response.text());
  }
  return await response.json();
}
export class PHPClient implements WebApi<APIConfig> {
  config: APIConfig;
  constructor(
    public serverUrl: string,
    public keyPair: CryptoKeyPair,
    /*public repoId: string,
    public apiKey: string,*/
  ) {this.config={serverUrl,keyPair/*repoId,apiKey*/};}
  toString(){
    return `[${this.serverUrl}: `;//${this.repoId}]`;
  }
  private post(action: Actions, data: any) {
    return post(this.serverUrl, action,data); 
  }
  async uploadObjects(objects: ObjectEntry[]): Promise<Date> {
    const sObjects: StringifiedObject[] = 
        objects.map((entry)=>({
            hash: entry.hash,
            content: toBase64(entry.content)
        }));
    const data=await this.post("upload", {
      //repo_id: this.repoId,
      //api_key: this.apiKey,
      objects: sObjects,
    });
    return phpTimestampToDate(data.timestamp);
  }
  async downloadObjects(hashList: Hash[]): Promise<ObjectEntry[]> {
    const res = await this.post("download", {
      //repo_id: this.repoId,
      //api_key: this.apiKey,
      hash_list: hashList,
    });
    const sObjects=res.objects as StringifiedObject[];
    const objects: ObjectEntry[]=[];
    for (const { hash, content, mtime } of sObjects) {
      asHash(hash);
      const mtimed= mtime? phpTimestampToDate(mtime):new Date();
      objects.push({ hash, content: Buffer.from(content, 'base64'), mtime:mtimed });
    }
    return objects;
  }
  async getTimeLine(after:Date,before: Date):Promise<Timeline[]>{

  }
  async commit(t:Timeline):Promise<void>{

  }
}
