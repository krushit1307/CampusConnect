import { useRef, useState } from "react";
import Send from "lucide-react/dist/esm/icons/send";
import Paperclip from "lucide-react/dist/esm/icons/paperclip";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { useChatStore } from "@/store/useChatStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DeepfakeAudioDetectorService } from "@/services/deepfakeAudioDetectorService";

interface MessageInputProps {
  onSend: (e: React.FormEvent) => void;
  onTyping: () => void;
  onFocus: () => void;
  typingUsers: string[];
}

export default function MessageInput({
  onSend,
  onTyping,
  onFocus,
  typingUsers,
}: MessageInputProps) {
  const inputMessage = useChatStore((s) => s.inputMessage);
  const setInputMessage = useChatStore((s) => s.setInputMessage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validating, setValidating] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Check if file is audio (.mp3 or .wav)
      const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (fileExtension !== ".mp3" && fileExtension !== ".wav") {
        toast.error("Unsupported file type. Chat attachments are restricted to .mp3 and .wav audio files.");
        return;
      }

      setValidating(true);
      toast.info("Scanning audio for voice cloning/deepfake anomalies...");

      try {
        const { valid, error } = await DeepfakeAudioDetectorService.validateAudioFile(file);

        if (!valid) {
          toast.error(error || "Upload blocked: Deepfake audio detected (Impersonation/Generative AI Fraud).");
        } else {
          toast.success("Audio verified: No synthetic voice artifacts detected.");
          // Append audio filename to input message
          setInputMessage(
            inputMessage ? `${inputMessage} [Audio Attachment: ${file.name}]` : `[Audio Attachment: ${file.name}]`
          );
        }
      } catch (err: any) {
        console.error("Deepfake validation error:", err);
        toast.error("Audio validation failed. Please try again.");
      } finally {
        setValidating(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  return (
    <form
      onSubmit={onSend}
      className="border-t-2 border-black p-3 bg-white dark:bg-zinc-900 dark:border-cream flex flex-col gap-2"
    >
      <div
        className="min-h-[1.25rem] flex items-center gap-1.5"
        aria-live="polite"
        aria-atomic="true"
      >
        {typingUsers.length > 0 && (
          <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 italic animate-pulse">
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing…`
              : typingUsers.length === 2
                ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
                : "Several people are typing…"}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav"
          className="hidden"
          onChange={handleFileChange}
          data-testid="chat-audio-file-input"
        />
        <Button
          type="button"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={validating}
          className="h-10 w-10 border-2 border-black bg-amber-400 text-black neu-border neu-press"
          title="Attach audio file"
          data-testid="chat-audio-attach-button"
        >
          {validating ? (
            <Loader2 className="h-4 w-4 animate-spin text-black" />
          ) : (
            <Paperclip className="h-4 w-4 text-black" />
          )}
        </Button>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => {
            setInputMessage(e.target.value);
            onTyping();
          }}
          onFocus={onFocus}
          placeholder="Type a secure message..."
          className="flex-1 border-2 border-black px-3 py-2 font-mono text-sm focus:outline-none dark:bg-zinc-800 dark:border-cream dark:text-cream"
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 border-2 border-black bg-lime text-black neu-border neu-press"
          disabled={validating}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

