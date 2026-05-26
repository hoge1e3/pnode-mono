//@ts-check
import { WebSocketServer } from "ws";
import chokidar from "chokidar";
import * as fs from "fs";
import * as path from "path";

const EXCLUDE_NAMES=[".gsync", ".git"];
const WS_PORT = 8080;
const SERVER_ROOT=resolveSlash(".");
createWsServer({
  EXCLUDE_NAMES, WS_PORT, SERVER_ROOT,
});
/**
 * @param {string} p 
 * @returns 
 */
function resolveSlash(p){
  return path.resolve(p).replace(/\\/g,"/");
}
/**
 * 
 * @param {{EXCLUDE_NAMES:string[], SERVER_ROOT:string, WS_PORT:number}} param0 
 */
export function createWsServer({EXCLUDE_NAMES, SERVER_ROOT, WS_PORT}){
  const wss = new WebSocketServer({ port: WS_PORT });
  // 接続中のクライアント
  const clients = new Set();
  // WebSocket 接続
  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log("client connected");

    // 初期ファイル送信
    //sendAllFiles(ws);

    ws.on("message", (msg) => {
      try {
        const { type, path: browserPath, info } = JSON.parse(msg.toString());
        if (excludes(browserPath)) return;
        const serverPath = path.join(SERVER_ROOT,browserPath);
        if (!serverPath || excludes(serverPath)) return;
        if (type === "update") {
          fs.mkdirSync(path.dirname(serverPath), { recursive: true });
          dataURLToFile(info.content, serverPath);
          fs.utimesSync(serverPath, new Date(), new Date(info.mtime));
        } else if (type === "delete") {
          if (fs.existsSync(serverPath)) {
            fs.unlinkSync(serverPath);
          }
        }
      } catch (e) {
        console.error("message error", e);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log("client disconnected");
    });
  });

  // ファイル変更監視 (再帰的)
  const watcher = chokidar.watch(SERVER_ROOT, { ignoreInitial: true, persistent: true });
  watcher
    .on("add", (file) => notifyChange("update", file))
    .on("change", (file) => notifyChange("update", file))
    .on("unlink", (file) => notifyChange("delete", file));

  /**
   * 
   * @param {string} p 
   * @returns 
   */
  function excludes(p) {
    while(true) {
      if (EXCLUDE_NAMES.includes(path.basename(p))) return true;
      const np=path.dirname(p);
      if (np==p) return false;
      p=np;
    }
  }

  /**
   * 
   * @param {"delete"|"update"} type 
   * @param {string} fullPath 
   * @returns 
   */
  function notifyChange(type, fullPath) {
    const serverPath = fullPath; //path.relative(SERVER_ROOT, fullPath).replace(/\\/g, "/");
    if (!serverPath||excludes(serverPath)) return;
    const browserPath = path.relative(SERVER_ROOT, serverPath);
    if (!browserPath||excludes(browserPath)) return;
    if (type === "delete") {
      broadcast({ type: "delete", path: browserPath });
    } else {
      try {
        const info = readFileInfo(serverPath);
        broadcast({ type: "update", path: browserPath, info });
      } catch (e) {
        console.error("notify error", serverPath, e);
      }
    }
  }
  /**
   * 
   * @param {object} msg 
   */
  function broadcast(msg) {
    const str = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(str);
      }
    }
  }
}

// ファイルを読み込んで {mtime, content} に変換
/**
 * 
 * @param {string} filePath 
 * @returns 
 */
function readFileInfo(filePath) {
  const fullPath = filePath;// path.join(IDB_ROOT, filePath);
  const stat = fs.statSync(fullPath);
  const mtime = stat.mtimeMs;
  const content = fileToDataURL(fullPath);// fs.readFileSync(fullPath, "utf8"); 
  return { mtime, content };
}

/**
 * 
 * @param {string} filePath 
 * @param {string} mimeType 
 * @returns {string}
 */
export function fileToDataURL(filePath, mimeType = "application/octet-stream") {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
/**
 * 
 * @param {string} dataURL 
 * @param {string} filePath 
 */
export function dataURLToFile(dataURL, filePath) {
  const match = dataURL.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid dataURL format: "+dataURL.substring(0,50));
  }
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(filePath, buffer);
}


// 全ファイルを初期送信
/*function sendAllFiles(ws) {
  const initData=[];
  function walk(dir, base = "") {
    const rel=path.relative(IDB_ROOT, dir).replace(/\\/g,"/");
    console.log("Walk",rel);
    if (EXCLUDES.includes( rel )) {
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = path.join(base, entry.name).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), relPath);
      } else {
        try {
          const info = readFileInfo(relPath);
          initData.push({path: relPath, info});
          //ws.send(JSON.stringify({ type: "update", path: relPath, info }));
        } catch (e) {
          console.error("read error", relPath, e);
        }
      }
    }
  }
  walk(IDB_ROOT);
  ws.send(JSON.stringify({ type: "init", files: initData}));
}*/

/*
function browserPathToServerPath(b){
  for(const p of peers){
    if (b.startsWith(p.browser)){
      return path.join(p.server, path.relative(p.browser, b));
    }
  }
  console.warn("Unmatched browserPath: ", b);
}
function serverPathToBrowserPath(s){
  const rs=resolveSlash(s);//fs.realpathSync(s); does not work in non-existeng
  for(const p of peers){  
    if (rs.startsWith(p.server)) {
      return path.join(p.browser, path.relative(p.server, s)).replace(/\\/g,"/");
    }
  }
  console.warn("Unmatched serverPath: ", s);
}*/
