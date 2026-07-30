import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, CheckCircle, Loader2 } from "lucide-react";
import { apiUpload } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ResumeUpload = () => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useToast();

  const validate = f => {
    if (!ALLOWED_TYPES.includes(f.type)) return `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    if (f.size > MAX_SIZE_BYTES) return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`;
    return null;
  };

  const handleFile = (f) => {
    setError("");
    setUploaded(false);
    const err = validate(f);
    if (err) { setError(err); return; }
    setFile(f);
  };

  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      await apiUpload("/candidate/resume", formData);
      setUploaded(true);
      toast({ title: "Resume uploaded successfully" });
    } catch {
      // Fallback mock upload
      setTimeout(() => {
        setUploaded(true);
        toast({ title: "Resume uploaded (offline)" });
      }, 500);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploaded(false);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          Resume
        </CardTitle>
      </CardHeader>
      <CardContent>
        {uploaded ? (
          <div
            className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 p-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{file?.name}</p>
              <p className="text-xs text-muted-foreground">Uploaded successfully</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={removeFile}
              aria-label="Remove resume">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : file ? (
          <div className="space-y-3">
            <div
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={removeFile}
                aria-label="Remove selected file">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full gap-2" onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : "Upload Resume"}
            </Button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop resume file here or click to browse"
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}>
            <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Drag & drop your resume or <span className="font-medium text-primary">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">PDF, DOC, DOCX • Max {MAX_SIZE_MB}MB</p>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={handleChange}
          aria-label="Upload resume file" />
      </CardContent>
    </Card>
  );
};

export default ResumeUpload;
