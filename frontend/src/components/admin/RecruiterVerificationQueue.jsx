import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import StatusBadge from "@/components/shared/StatusBadge";
import DocumentList from "@/components/shared/DocumentList";
import { Loader2, ShieldCheck, Globe, Mail, Phone, MapPin, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, resolveFileUrl } from "@/lib/api";
import { COMPANY_SIZE_LABELS } from "@/constants/company";

const mapStatus = s => {
  const lower = (s || "").toLowerCase();
  if (lower === "verified" || lower === "approved") return "approved";
  if (lower === "rejected") return "rejected";
  if (lower === "pending") return "pending";
  return "none";
};

const DetailRow = ({
  icon: Icon,
  label,
  value
}) => (
  <div className="space-y-0.5">
    <p
      className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </p>
    <p className="text-sm">
      {value === undefined || value === null || value === "" ? (
        <span className="text-muted-foreground">Not provided</span>
      ) : (
        value
      )}
    </p>
  </div>
);

const RecruiterVerificationQueue = () => {
  const { toast } = useToast();
  const [recruiters, setRecruiters] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [checked, setChecked] = useState(new Set());

  const fetchRecruiters = useCallback(async () => {
    setLoading(true);
    try {
      const query = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
      const data = await api(`/admin/recruiters${query}`);
      setRecruiters(data.recruiters || []);
      setChecked(new Set());
    } catch (err) {
      toast({
        title: "Failed to load recruiters",
        description: err?.message,
        variant: "destructive",
      });
      setRecruiters([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchRecruiters();
  }, [fetchRecruiters]);

  const decide = async (userId, status) => {
    setActionLoading(true);
    try {
      await api(`/admin/recruiter/${userId}/verify`, {
        method: "PUT",
        body: { status, ...(status === "REJECTED" ? { reason: rejectReason } : {}) },
      });
      toast({
        title: status === "VERIFIED" ? "Recruiter verified" : "Recruiter rejected",
      });
      setSelected(null);
      setRejectReason("");
      fetchRecruiters();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const bulkVerify = async () => {
    if (checked.size === 0) return;
    setActionLoading(true);
    try {
      const res = await api(
        "/admin/recruiters/bulk-verify",
        { method: "POST", body: { userIds: Array.from(checked) } }
      );
      toast({
        title: `${res.verified} recruiter${res.verified === 1 ? "" : "s"} verified`,
        description: res.skipped.length ? `${res.skipped.length} skipped.` : undefined,
      });
      fetchRecruiters();
    } catch (err) {
      toast(
        { title: "Bulk verify failed", description: err?.message, variant: "destructive" }
      );
    } finally {
      setActionLoading(false);
    }
  };

  const selectable = recruiters.filter((r) => r.verificationStatus !== "VERIFIED");
  const allSelected = selectable.length > 0 && checked.size === selectable.length;

  const toggleAll = (state) =>
    setChecked(state ? new Set(selectable.map((r) => r._id)) : new Set());

  const toggleOne = (id, state) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (state) next.add(id);
      else next.delete(id);
      return next;
    });

  const profile = selected?.profile;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Recruiter Verification</CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="VERIFIED">Verified</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="ALL">All</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={bulkVerify}
                disabled={checked.size === 0 || actionLoading}>
                <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                Verify selected ({checked.size})
              </Button>

              <Button variant="outline" size="sm" onClick={fetchRecruiters} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2
                className="h-8 w-8 animate-spin text-muted-foreground"
                aria-label="Loading" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(s) => toggleAll(s === true)}
                      aria-label="Select all recruiters"
                      disabled={selectable.length === 0} />
                  </TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {recruiters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No recruiters found for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  recruiters.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell>
                        <Checkbox
                          checked={checked.has(r._id)}
                          onCheckedChange={(s) => toggleOne(r._id, s === true)}
                          aria-label={`Select ${r.profile?.companyName || r.name}`}
                          disabled={r.verificationStatus === "VERIFIED"} />
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          {r.profile?.companyLogo ? (
                            <img
                              src={resolveFileUrl(r.profile.companyLogo)}
                              alt=""
                              className="h-8 w-8 rounded border object-contain" />
                          ) : (
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded border bg-muted text-xs font-bold">
                              {(r.profile?.companyName || r.name).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{r.profile?.companyName || "—"}</p>
                            <p className="text-xs text-muted-foreground">{r.name}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                      <TableCell className="text-sm">{r.profile?.industry || "—"}</TableCell>

                      <TableCell className="w-32">
                        <div className="flex items-center gap-2">
                          <Progress value={r.profileCompletion} className="h-2 flex-1" />
                          <span className="text-xs font-medium">{r.profileCompletion}%</span>
                        </div>
                        {r.profile?.onboardingStatus && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {r.profile.onboardingStatus}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={mapStatus(r.verificationStatus)} />
                      </TableCell>

                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Review dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={() => {
          setSelected(null);
          setRejectReason("");
        }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
              {profile?.companyName || selected?.name}
            </DialogTitle>
            <DialogDescription>
              Registered by {selected?.name} ({selected?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Industry" value={profile?.industry} />
              <DetailRow
                label="Company size"
                value={
                  profile?.companySize
                    ? COMPANY_SIZE_LABELS[profile.companySize] || profile.companySize
                    : undefined
                } />
              <DetailRow icon={Globe} label="Website" value={profile?.website} />
              <DetailRow label="Founded" value={profile?.foundedYear} />
              <DetailRow label="HR contact" value={profile?.hrContactPerson} />
              <DetailRow icon={Phone} label="HR number" value={profile?.hrContactNumber} />
              <DetailRow icon={Mail} label="Company email" value={profile?.companyEmail} />
              <DetailRow label="GST number" value={profile?.gstNumber} />
              <DetailRow
                icon={MapPin}
                label="Location"
                value={
                  [profile?.city, profile?.state, profile?.country].filter(Boolean).join(", ") ||
                  undefined
                } />
            </div>

            <DetailRow label="Description" value={profile?.companyDescription} />

            <div className="space-y-1.5">
              <p
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Accessibility facilities
              </p>
              {profile?.accessibilityFacilities?.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {profile.accessibilityFacilities.map((f) => (
                    <li key={f}>
                      <Badge variant="secondary">{f}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None listed</p>
              )}
            </div>

            {/* The evidence this decision rests on. Previously a bare list of
                links, which could not work: these files are served behind auth
                and a plain href sends no bearer token. DocumentList previews
                them inline instead. Read-only — admins review, never delete. */}
            <div className="space-y-1.5">
              <p
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Verification documents
              </p>
              <DocumentList
                documents={profile?.verificationDocuments || []}
                emptyMessage="No documents submitted. Reject and ask the company to upload proof rather than approving unverified." />
            </div>

            <div className="space-y-2">
              <label htmlFor="recruiter-reject-reason" className="text-sm font-medium">
                Rejection reason (required to reject)
              </label>
              <Textarea
                id="recruiter-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Company details could not be verified." />
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => selected && decide(selected._id, "VERIFIED")}
                disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  "Approve"
                )}
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                onClick={() => selected && decide(selected._id, "REJECTED")}
                disabled={!rejectReason || actionLoading}>
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  "Reject"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecruiterVerificationQueue;
