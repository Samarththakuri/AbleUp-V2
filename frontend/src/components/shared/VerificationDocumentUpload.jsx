import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, Loader2, FileText, ShieldCheck } from "lucide-react";
import { apiUpload } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * Uploads a verification document (UDID card, disability certificate,
 * incorporation certificate…).
 *
 * Mirrors the interaction pattern of ResumeUpload and CompanyLogoUpload —
 * keyboard-operable dropzone, client-side type/size checks matching the
 * server's multer limits — with a required document-type select, because the
 * server validates `docType` against a shared enum and rejects anything else.
 *
 * Unlike ResumeUpload this never fakes success on failure: a document the user
 * believes was uploaded but was not will stall their verification with no
 * explanation.
 */
const VerificationDocumentUpload = ({
  endpoint,
  method = "POST",
  docTypes,
  onUploaded
}) => {
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useToast();

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

  const reset = () => {
    setFile(null);
    setDocType("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!file || !docType) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("docType", docType);
      const res = await apiUpload(endpoint, formData, method);
      onUploaded(res);
      reset();
      toast({ title: "Document uploaded", description: docType });
    } catch (err) {
      const message = err?.message || "Upload failed";
      setError(message);
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="doc-type">Document type</Label>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger id="doc-type">
            <SelectValue placeholder="Select the type of document" />
          </SelectTrigger>
          <SelectContent>
            {docTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {file ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={reset}
            disabled={uploading}
            aria-label="Discard selected file">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop a verification document here or click to browse"
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
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
          <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Drag & drop your document or{" "}
            <span className="font-medium text-primary">browse</span>
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, JPG, PNG • Max {MAX_SIZE_MB}MB
          </p>
        </div>
      )}
      {file && (
        <Button
          className="w-full gap-2"
          onClick={handleUpload}
          disabled={uploading || !docType}>
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          {uploading ? "Uploading..." : "Upload document"}
        </Button>
      )}
      {file && !docType && (
        <p className="text-xs text-muted-foreground">
          Choose a document type to enable upload.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Only you and platform administrators can view these documents. They are
        never shown to recruiters or other candidates.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        aria-label="Upload verification document" />
    </div>
  );
};

export default VerificationDocumentUpload;
