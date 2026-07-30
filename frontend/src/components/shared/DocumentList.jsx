import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Eye, Trash2, Loader2 } from "lucide-react";
import DocumentViewer from "@/components/shared/DocumentViewer";

/**
 * Renders verification documents with an inline preview, and optionally a
 * delete action for the person who owns them.
 *
 * Shared by the candidate profile, the recruiter profile and both admin
 * verification queues, so all four show the same thing: document type, upload
 * date, and a preview that goes through the authenticated route.
 */
const DocumentList = ({
  documents,
  onDelete,
  emptyMessage = "No documents uploaded yet."
}) => {
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (doc) => {
    if (!onDelete) return;
    setDeleting(doc.url);
    try {
      await onDelete(doc);
    } finally {
      setDeleting(null);
    }
  };

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li
            key={doc.url}
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {doc.docType}
              </p>
              {doc.uploadedAt && (
                <p className="text-xs text-muted-foreground">
                  Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <Badge variant="secondary" className="hidden sm:inline-flex">
              {doc.url.split(".").pop()?.toUpperCase() || "FILE"}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewing(doc)}
              aria-label={`View ${doc.docType}`}>
              <Eye className="h-4 w-4" />
            </Button>

            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(doc)}
                disabled={deleting === doc.url}
                aria-label={`Delete ${doc.docType}`}>
                {deleting === doc.url ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <DocumentViewer document={viewing} onClose={() => setViewing(null)} />
    </>
  );
};

export default DocumentList;
