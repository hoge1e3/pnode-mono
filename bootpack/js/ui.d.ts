import type { MenuButton } from "./types.js";
export declare function showModal(s?: string | boolean): HTMLElement;
export declare function btn(c: string | string[], a: () => any): MenuButton;
export declare function rmbtn(): void;
export declare function splash(mesg: string, sp: HTMLElement): Promise<void>;
export declare function uploadFile(opt?: {
    onShow?: (evt: {
        dom: HTMLElement;
    }) => void;
}): Promise<Blob>;
