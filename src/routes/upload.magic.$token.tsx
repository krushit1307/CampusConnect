import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { getSupabaseUrl } from "@/lib/supabase/client";

export default function MagicUpload() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const supabaseUrl = getSupabaseUrl();

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/magic-link-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "validate", token }),
        });
        const data = await res.json();
        
        if (res.ok && data.valid) {
          setIsValid(true);
          setEventTitle(data.eventTitle);
        } else {
          setIsValid(false);
          toast.error(data.error || "Invalid or expired token");
        }
      } catch (err) {
        setIsValid(false);
        toast.error("Failed to validate magic link");
      } finally {
        setIsValidating(false);
      }
    }
    
    if (token) {
      validateToken();
    }
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const validFiles = filesArray.filter((file) => file.type.startsWith("image/"));
      if (validFiles.length !== filesArray.length) {
        toast.error("Only image files are allowed.");
      }
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    
    try {
      // 1. Get signed URLs
      const fileNames = selectedFiles.map(f => f.name);
      const urlsRes = await fetch(`${supabaseUrl}/functions/v1/magic-link-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_urls", token, files: fileNames }),
      });
      const urlsData = await urlsRes.json();
      
      if (!urlsRes.ok) throw new Error(urlsData.error || "Failed to generate upload URLs");

      const filePaths: string[] = [];

      // 2. Upload each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const { signedUrl, path } = urlsData.urls[i];
        
        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });
        
        if (!uploadRes.ok) throw new Error(`Failed to upload ${file.name}`);
        filePaths.push(path);
      }

      // 3. Confirm upload
      const confirmRes = await fetch(`${supabaseUrl}/functions/v1/magic-link-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_upload", token, filePaths }),
      });
      const confirmData = await confirmRes.json();
      
      if (!confirmRes.ok) throw new Error(confirmData.error || "Failed to confirm upload");
      
      setUploadComplete(true);
      toast.success("Photos uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow text-center border-t-4 border-red-500">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">
            This photo upload link is invalid, expired, or has already been used.
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            Return to Homepage
          </Button>
        </div>
      </div>
    );
  }

  if (uploadComplete) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow text-center border-t-4 border-green-500">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Upload Complete!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for uploading photos for <strong>{eventTitle}</strong>. 
            The memories are now shared with the attendees!
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            Go to Homepage
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-8">
        <div className="text-center mb-8">
          <UploadCloud className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-3xl font-extrabold text-gray-900">
            Upload Photos
          </h2>
          <p className="mt-2 text-lg text-gray-600">
            Add photos for your recent event: <span className="font-semibold text-gray-900">{eventTitle}</span>
          </p>
        </div>

        <div className="space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer text-indigo-600 font-medium hover:text-indigo-500"
            >
              <span>Click to select photos</span>
            </label>
            <p className="text-sm text-gray-500 mt-1">PNG, JPG, GIF up to 10MB each</p>
          </div>

          {selectedFiles.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Photos ({selectedFiles.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-100 flex items-center justify-center">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="object-cover w-full h-full"
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <AlertCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-gray-200">
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
              className="w-full flex justify-center py-3"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Uploading...
                </>
              ) : (
                'Upload Photos'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
