export declare const getFilesInDirectory: (directory: string) => Promise<Array<{
    name: string;
    path: string;
    mtime: Date;
}>>;
export declare const saveLastSelectedModel: (filePath: string) => Promise<void>;
export declare const getLastSelectedModel: () => Promise<string | null>;
//# sourceMappingURL=utils.d.ts.map