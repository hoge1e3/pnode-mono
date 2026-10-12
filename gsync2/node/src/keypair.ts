import { promises as fs } from "node:fs";
import { FilePath } from "./types";
import { join } from "./util";

export class KeyPair {
    constructor(public dir: FilePath) {}
    async generate(): Promise<CryptoKeyPair> {
        await fs.mkdir(this.dir, { recursive: true });
        const keys = await crypto.subtle.generateKey(
            { name: "Ed25519" },
            true,
            ["sign", "verify"],
        );
        const publicKey = await crypto.subtle.exportKey(
            "spki",
            keys.publicKey,
        );
        const privateKey = await crypto.subtle.exportKey(
            "pkcs8",
            keys.privateKey,
        );
        await fs.writeFile(
            this.publicKeyFile(),
            this.toPem("PUBLIC KEY", publicKey),
            "utf8",
        );
        await fs.writeFile(
            this.privateKeyFile(),
            this.toPem("PRIVATE KEY", privateKey),
            { encoding: "utf8", mode: 0o600 },
        );
        return keys;
    }
    async load(): Promise<CryptoKeyPair> {
        const publicPem = await fs.readFile(this.publicKeyFile(), "utf8");
        const privatePem = await fs.readFile(this.privateKeyFile(), "utf8");
        const publicKey = await crypto.subtle.importKey(
            "spki",
            this.fromPem(publicPem, "PUBLIC KEY"),
            { name: "Ed25519" },
            true,
            ["verify"],
        );
        const privateKey = await crypto.subtle.importKey(
            "pkcs8",
            this.fromPem(privatePem, "PRIVATE KEY"),
            { name: "Ed25519" },
            true,
            ["sign"],
        );
        return { publicKey, privateKey };
    }
    async has(): Promise<boolean> {
        try {
            await fs.access(this.publicKeyFile());
            await fs.access(this.privateKeyFile());
            return true;
        } catch {
            return false;
        }
    }
    async loadOrGenerate(): Promise<CryptoKeyPair> {
        const pubExists = await this.exists(this.publicKeyFile());
        const privExists = await this.exists(this.privateKeyFile());
        if (pubExists && privExists) {
            return this.load();
        }
        if (pubExists || privExists) {
            throw new Error("Incomplete key pair: only one key file exists");
        }
        return this.generate();
    }
    publicKeyFile() {
        return join(this.dir, "gsync_key.pub");
    }
    privateKeyFile() {
        return join(this.dir, "gsync_key");
    }
    private async exists(path: string): Promise<boolean> {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }
    private toPem(label: string, data: ArrayBuffer): string {
        const bytes = new Uint8Array(data);
        let binary = "";
        for (const b of bytes) {
            binary += String.fromCharCode(b);
        }
        const base64 = btoa(binary).match(/.{1,64}/g)!.join("\n");

        return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----\n`;
    }
    private fromPem(pem: string, label: string): ArrayBuffer {
        const begin = `-----BEGIN ${label}-----`;
        const end = `-----END ${label}-----`;
        const start = pem.indexOf(begin);
        const finish = pem.indexOf(end);
        if (start < 0 || finish < 0 || finish <= start) {
            throw new Error(`Invalid PEM format: ${label}`);
        }
        const base64 = pem
            .slice(start + begin.length, finish)
            .replace(/\s/g, "");
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}