import type { SFile } from "@hoge1e3/sfile";
import type { Menu, MenuButton, Menus } from "./types.js";
export declare function rmbtn(): void;
export declare function showMenus(rootPkgJson: SFile): MenuButton[];
export declare function parseMenus(menus: Menus): Menus;
export declare function scanPrefetchModule(rp: SFile): void;
export declare function showMainmenus(rp: SFile): MenuButton[];
export declare function runMenu(k: string, v: Menu): Promise<void>;
