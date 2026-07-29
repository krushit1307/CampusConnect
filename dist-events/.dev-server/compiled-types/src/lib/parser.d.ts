export interface ParsedFlyer {
    title: string;
    date: string;
    description: string;
}
export declare function parseFlyer(text: string): ParsedFlyer;
