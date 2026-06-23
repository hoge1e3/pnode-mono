/*
dist/js/index.jsのどこかに次のような文字列あったら現在時刻に置き換えて上書き保存。
__BUIL__yyyy-mmdd-hhmmss__T_AT__
例：　__BUIL__2026-0623-113320__T_AT__
*/
/*
dist/js/index.js の中にある

__BUIL__yyyy-mmdd-hhmmss__T_AT__

の形式の文字列を現在時刻に置換して上書き保存する。
*/
import * as fs from "fs";
import * as path from "path";

import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const file = path.join(__dirname, "dist", "index.js");

function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");

    return `${yyyy}-${mm}${dd}-${hh}${mi}${ss}`;
}

const timestamp = `__BUIL__${formatDate(new Date())}__T_AT__`;

let text = fs.readFileSync(file, "utf8");

text = text.replace(
    /__BUIL__\d{4}-\d{4}-\d{6}__T_AT__/g,
    timestamp
);

fs.writeFileSync(file, text, "utf8");

console.log(`Updated build timestamp: ${timestamp}`);