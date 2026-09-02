import React, { useState } from 'react';
import { StudentResumeProfile, EmployerBooth } from '@/types/careerFair';
import { X, Upload, FileText, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';

interface ResumeMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate: (profile: StudentResumeProfile) => void;
  currentProfile: StudentResumeProfile;
}

export function ResumeMatchModal({
  isOpen,
  onClose,
  onProfileUpdate,
  currentProfile,
}: ResumeMatchModalProps) {
  const [name, setName] = useState(currentProfile.name);
  const [major, setMajor] = useState(currentProfile.major);
  const [skills, setSkills] = useState(currentProfile.skills.join(', '));
  const [summary, setSummary] = useState(currentProfile.experienceSummary);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    currentProfile.resumeFileName || null
  );

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsVectorizing(true);

    // Simulate AI resume vector embedding extraction
    setTimeout(() => {
      setIsVectorizing(false);
      setSkills('React, TypeScript, Python, PyTorch, Distributed Systems, SQL, Docker, FastAPI');
      setSummary(
        'B.S. in CS with prior SWE internship experience building cloud pipelines and machine learning inference backends.'
      );
    }, 1200);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onProfileUpdate({
      name,
      major,
      graduationYear: currentProfile.graduationYear,
      skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      experienceSummary: summary,
      resumeFileName: uploadedFileName || undefined,
      targetRoles: currentProfile.targetRoles,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border-4 border-black rounded-lg max-w-lg w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 border-2 border-black rounded hover:bg-gray-100"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-black">
              AI Resume Vectorizer & Matcher
            </h2>
            <p className="text-xs font-mono text-gray-600">
              Upload your PDF resume to compute cosine similarity scores with company job specs.
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="my-4 border-2 border-dashed border-black rounded-lg p-6 bg-slate-50 text-center hover:bg-slate-100 transition-colors relative cursor-pointer">
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-white border-2 border-black rounded-full shadow-xs">
              <Upload size={22} className="text-black" />
            </div>
            <div>
              <p className="font-display font-black text-sm text-black">
                {uploadedFileName ? uploadedFileName : 'Click to Upload Resume (PDF)'}
              </p>
              <p className="font-mono text-xs text-gray-500">
                Automatic entity extraction & vector embeddings via OpenAI
              </p>
            </div>
          </div>
        </div>

        {isVectorizing && (
          <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-300 rounded flex items-center gap-2 font-mono text-xs text-blue-900 animate-pulse">
            <Sparkles size={16} className="animate-spin text-blue-600" />
            <span>Extracting semantic embeddings and scoring company job descriptions...</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">Student Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black rounded font-mono text-xs bg-white"
              />
            </div>
            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">Major</label>
              <input
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black rounded font-mono text-xs bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">Extracted Technical Skills</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g. Python, React, PyTorch, SQL"
              className="w-full px-3 py-2 border-2 border-black rounded font-mono text-xs bg-white"
            />
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">Experience Summary</label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded font-mono text-xs bg-white"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border-2 border-black rounded font-mono text-xs font-bold uppercase hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-lime hover:bg-lime/90 border-2 border-black rounded font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5"
            >
              Update AI Matches <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
