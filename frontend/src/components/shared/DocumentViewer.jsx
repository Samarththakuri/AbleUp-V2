import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { fetchProtectedFile } from "@/lib/api";

/**
 * Previews a verification document inside a dialog.
 *
 * These files are served by /api/documents behind auth, so they cannot be put
 * in an `<img src>` or `<iframe src>` directly — the browser would send no
 * Authorization header. The file is fetched with the bearer token, turned into
 * an object URL, and rendered from that.
 *
 * Inline rather than a new tab on purpose: `window.open` after an await trips
 * popup blockers, and admins reviewing a queue should not have to leave the page.
 */
const DocumentViewer = ({
  document: doc,
  onClose
}) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const [contentType, setContentType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doc) {
      setObjectUrl(null);
      setError("");
      return;
    }

    let revoked = false;
    let created = null;

    setLoading(true);
    setError("");
    setObjectUrl(null);

    fetchProtectedFile(doc.url)
      .then((file) => {
        // The dialog may have closed while the fetch was in flight; releasing
        // the blob immediately avoids leaking it for the life of the document.
        if (revoked) {
          URL.revokeObjectURL(file.objectUrl);
          return;
        }
        created = file.objectUrl;
        setObjectUrl(file.objectUrl);
        setContentType(file.contentType);
      })
      .catch((err) => setError(err?.message || "Could not load this document"))
      .finally(() => setLoading(false));

    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [doc]);

  const isPdf = contentType.includes("pdf");

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{doc?.docType}</DialogTitle>
          <DialogDescription>
            {doc?.uploadedAt
              ? `Uploaded ${new Date(doc.uploadedAt).toLocaleDateString()}`
              : "Verification document"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[300px]">
          {loading && (
            <div className="flex h-[400px] items-center justify-center">
              <Loader2
                className="h-8 w-8 animate-spin text-muted-foreground"
                aria-label="Loading document" />
            </div>
          )}

          {error && (
            <div
              className="flex h-[300px] flex-col items-center justify-center gap-2 text-center"
              role="alert">
              <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                The file may have been removed, or you may not have permission to
                view it.
              </p>
            </div>
          )}

          {objectUrl &&
            (isPdf ? (
              <iframe
                src={objectUrl}
                title={`${doc?.docType} preview`}
                className="h-[65vh] w-full rounded-md border border-border" />
            ) : (
              <img
                src={objectUrl}
                alt={`${doc?.docType} preview`}
                className="mx-auto max-h-[65vh] rounded-md border border-border object-contain" />
            ))}
        </div>

        {objectUrl && (
          <div className="flex justify-end">
            <Button asChild variant="outline" className="gap-2">
              {/* download works off the object URL, so it needs no second
                  authenticated request */}
              <a href={objectUrl} download={`${doc?.docType || "document"}`}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentViewer;
