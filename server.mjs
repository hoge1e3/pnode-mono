//@ts-check
import express from "express";
import http from "http";
import * as path from "path";
//---Config
const SERVER_ROOT=resolveSlash(".");
const HTTP_PORT= 3000;
const PUBLIC = SERVER_ROOT;
//-----
const app = express();
const server = http.createServer(app);
// 静的ファイル提供 (client.html など)
app.use(express.static(PUBLIC));
server.listen(HTTP_PORT, () => {
  console.log(`Server running at http://localhost:${HTTP_PORT}/pnode-bootloader`);
});
/**
 * 
 * @param {string} p 
 * @returns 
 */
function resolveSlash(p){
  return path.resolve(p).replace(/\\/g,"/");
}
/*createWsServer({
  EXCLUDE_NAMES, SERVER_ROOT, WS_PORT
});*/
