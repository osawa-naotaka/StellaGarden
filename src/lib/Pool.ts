export class Pool<T> {
    private pool: T[] = [];
    private ptr = 0;
    private createFn: () => T;

    constructor(createFn: () => T) {
        this.createFn = createFn;
    }

    acquire(): T {
        if (this.pool.length <= this.ptr) {
            this.pool[this.ptr] = this.createFn();
        }
        return this.pool[this.ptr++];
    }

    releaseAll() {
        this.ptr = 0;
    }
}
