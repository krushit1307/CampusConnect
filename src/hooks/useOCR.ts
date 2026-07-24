import { useState } from "react";
import { extractText } from "@/lib/ocr";
import { parseFlyer, type ParsedFlyer } from "@/lib/parser";
import { toast } from "sonner";

interface UseOCRProps {
  onSuccess: (data: ParsedFlyer) => void;
}

export function useOCR({ onSuccess }: UseOCRProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const processFlyer = async (file: File) => {
    setIsProcessing(true);
    try {
      const toastId = toast.loading("Extracting text from flyer...");
      const text = await extractText(file);
      const parsed = parseFlyer(text);

      onSuccess(parsed);

      toast.success("Successfully extracted details!", { id: toastId });
    } catch (error) {
      console.error("OCR Error:", error);
      toast.error("Failed to read the image. Please try again or fill manually.");
    } finally {
      setIsProcessing(false);
    }
  };

  return { isProcessing, processFlyer };
}
