import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { apiUpload, resolveFileUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_SIZE_MB = 2;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * Company logo uploader — PATCH /recruiter/profile/logo.
 *
 * Follows the interaction pattern of components/candidate/ResumeUpload
 * (drag & drop, keyboard-operable dropzone, client-side type/size checks) but
 * for images, and it surfaces real failures instead of faking success.
 */
const CompanyLogoUpload = ({
  currentLogo,
  companyName,
  onUploaded
}) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useToast();

  // Object URLs must be revoked or they leak for the life of the document.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const validate = f => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFile = (f) => {
    setError("");
    const err = validate(f);
    if (err) {
      setError(err);
      return;
    }
    setFile(f);
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
    setError("");
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await apiUpload("/recruiter/profile/logo", formData, "PATCH");
      onUploaded(res);
      setFile(null);
      toast({ title: "Company logo updated" });
    } catch (err) {
      const message = err?.message || "Logo upload failed";
      setError(message);
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const displayed = preview || resolveFileUrl(currentLogo);
  const initial = companyName?.trim().charAt(0).toUpperCase() || "C";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {/* Logo preview / placeholder */}
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {displayed ? (
            <img
              src={displayed}
              alt={companyName ? `${companyName} logo` : "Company logo"}
              className="h-full w-full object-contain" />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground" aria-hidden="true">
              {initial}
            </span>
          )}
        </div>

        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop a company logo here or click to browse"
          className={`flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}>
          <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Drag & drop or <span className="font-medium text-primary">browse</span>
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WEBP • Max {MAX_SIZE_MB}MB
          </p>
        </div>
      </div>
      {file && (
        <div className="flex items-center gap-2">
          <Button className="flex-1 gap-2" onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? "Uploading..." : "Save logo"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setFile(null);
              setError("");
              if (inputRef.current) inputRef.current.value = "";
            }}
            aria-label="Discard selected logo"
            disabled={uploading}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        aria-label="Upload company logo" />
    </div>
  );
};

export default CompanyLogoUpload;
