import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";

interface DocumentUploaderProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export function DocumentUploader({ onUpload, isUploading }: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    onUpload(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={`neu-border p-4 text-center transition-colors ${
        dragOver ? "bg-lime border-black" : "bg-white"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {isUploading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
          <span className="font-mono text-xs font-bold">Uploading...</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full"
        >
          <Upload className="h-4 w-4" />
          <span className="font-mono text-xs font-bold">Drop a file here or click to upload</span>
        </button>
      )}
    </div>
  );
}
