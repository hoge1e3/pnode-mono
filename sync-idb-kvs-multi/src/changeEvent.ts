export type ChangeEvent<T>={key: string, value: T | null, oldValue: T|null};
export class ChangeEventTrait<T> {
    constructor(public target:any){}
    private listeners: Set<(e:ChangeEvent<T>) => void> = new Set();    
    addEventListener(type:"change",callback: (e:ChangeEvent<T>) => void): void {
        this.listeners.add(callback);
    }
    removeEventListener(callback: (e:ChangeEvent<T>) => void): void {
        this.listeners.delete(callback);
    }
    notifyListeners(key: string, value: T | null, oldValue: T |null): void {
        this.listeners.forEach(callback => callback.call(this.target,{key, value, oldValue}));
    }
    bypass(source: ChangeEventTrait<T>): void {
        source.addEventListener("change", (e: ChangeEvent<T>) => {
            this.notifyListeners(e.key, e.value, e.oldValue);
        });
    }   
}
    
