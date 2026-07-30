import { type ParsedFlyer } from "@/lib/parser";
interface UseOCRProps {
    onSuccess: (data: ParsedFlyer) => void;
}
export declare function useOCR({ onSuccess }: UseOCRProps): {
    isProcessing: boolean;
    processFlyer: (file: File) => Promise<void>;
};
export {};
