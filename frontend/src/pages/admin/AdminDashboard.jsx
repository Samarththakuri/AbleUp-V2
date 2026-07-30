import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import RecruiterVerificationQueue from "@/components/admin/RecruiterVerificationQueue";
import DocumentList from "@/components/shared/DocumentList";

const mapStatus = s => {
  const lower = s.toLowerCase();
  if (lower === "verified" || lower === "approved") return "approved";
  if (lower === "rejected") return "rejected";
  if (lower === "pending") return "pending";
  return "none";
};

const AdminDashboard = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const data = await api("/admin/users?role=CANDIDATE");
      const mapped = data.users.map((u) => ({
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        udid: u.udidNumber || u.udid || "—",
        disabilityType: u.disabilityType || "—",
        disabilityPercentage: u.disabilityPercentage,
        verificationDocuments: u.verificationDocuments || [],
        status: mapStatus(u.verificationStatus || "pending"),
      }));
      setCandidates(mapped);
    } catch (err) {
      // Deliberately no mock-data fallback. This queue is the gate that lets
      // real people apply for jobs; showing four invented candidates when the
      // API is down hides the outage and invites decisions on fictional rows.
      setCandidates([]);
      toast({
        title: "Could not load candidates",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const updateStatus = async (id, status) => {
    setActionLoading(true);
    const backendStatus = status === "approved" ? "VERIFIED" : "REJECTED";
    try {
      await api(`/admin/verify/${id}`, {
        method: "PUT",
        body: { status: backendStatus, reason: rejectReason },
      });
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      toast(
        { title: `Candidate ${status}`, description: `Status updated to ${status}.` }
      );
    } catch {
      // Fallback: update locally
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      toast(
        { title: `Candidate ${status} (offline)`, description: `Status updated locally.` }
      );
    } finally {
      setActionLoading(false);
      setSelected(null);
      setRejectReason("");
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30">
        <div className="container py-8">
          <h1 className="mb-8 text-2xl font-bold text-foreground">Admin Dashboard</h1>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Total Candidates</CardTitle>
              </CardHeader>
              <CardContent><p className="text-3xl font-bold text-foreground">{candidates.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <ShieldCheck className="h-5 w-5 text-success" />
                <CardTitle className="text-base">Verified</CardTitle>
              </CardHeader>
              <CardContent><p className="text-3xl font-bold text-foreground">{candidates.filter((c) => c.status === "approved").length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <ShieldX className="h-5 w-5 text-warning" />
                <CardTitle className="text-base">Pending</CardTitle>
              </CardHeader>
              <CardContent><p className="text-3xl font-bold text-foreground">{candidates.filter((c) => c.status === "pending").length}</p></CardContent>
            </Card>
          </div>

          <Tabs defaultValue="candidates" className="space-y-6">
            <TabsList>
              <TabsTrigger value="candidates">Candidate Verification</TabsTrigger>
              <TabsTrigger value="recruiters">Recruiter Verification</TabsTrigger>
            </TabsList>

            <TabsContent value="recruiters">
              <RecruiterVerificationQueue />
            </TabsContent>

            <TabsContent value="candidates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Verification Queue</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchCandidates} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>UDID</TableHead>
                      <TableHead>Disability Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No candidates found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      candidates.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-muted-foreground">{c.email}</TableCell>
                          <TableCell className="font-mono text-sm">{c.udid}</TableCell>
                          <TableCell>{c.disabilityType}</TableCell>
                          <TableCell><StatusBadge status={c.status} /></TableCell>
                          <TableCell>
                            {c.status === "pending" && (
                              <Button size="sm" variant="outline" onClick={() => setSelected(c)}>Review</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
      <Dialog
        open={!!selected}
        onOpenChange={() => { setSelected(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review: {selected?.name}</DialogTitle>
            <DialogDescription>
              Email: {selected?.email} — UDID: {selected?.udid} — {selected?.disabilityType}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Replaces a link to `udidDocumentUrl` — a field that was removed
                from the schema and that no upload path ever wrote, so this
                panel always said "No UDID document uploaded". */}
            <div className="space-y-1.5">
              <p
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Verification documents
              </p>
              <DocumentList
                documents={selected?.verificationDocuments || []}
                emptyMessage="No documents submitted. Reject and ask the candidate to upload their UDID card or disability certificate rather than approving unverified." />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-0.5">
                <p
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Disability type
                </p>
                <p className="text-sm">{selected?.disabilityType || "—"}</p>
              </div>
              <div className="space-y-0.5">
                <p
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Disability percentage
                </p>
                <p className="text-sm">
                  {selected?.disabilityPercentage != null
                    ? `${selected.disabilityPercentage}%`
                    : "—"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="reject-reason" className="text-sm font-medium">Rejection Reason (if rejecting)</label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason..." />
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => selected && updateStatus(selected.id, "approved")}
                disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                onClick={() => selected && updateStatus(selected.id, "rejected")}
                disabled={!rejectReason || actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
