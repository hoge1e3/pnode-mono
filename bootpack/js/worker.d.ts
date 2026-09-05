import type { FstabEntry } from "./types.js";
export declare function boot({ fstab, main, id }: {
    fstab: FstabEntry[];
    main: string;
    id: string;
}): Promise<void>;
export declare function console_server(w: MessageEventSource): void;
export declare function console_client(): any;
export declare function startWorker(): void;
