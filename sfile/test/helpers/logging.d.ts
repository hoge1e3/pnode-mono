export declare const _console: {
    taglist: {
        [key: string]: boolean;
    };
    unknownlist: {
        [key: string]: boolean;
    };
    error: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    log(tag: string, ...args: any[]): void;
};
export declare const alert: Function;
