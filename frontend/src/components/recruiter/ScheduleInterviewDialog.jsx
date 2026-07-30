import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ScheduleInterviewDialog = ({
  open,
  onOpenChange,
  applicationId,
  candidateName,
  jobTitle,
  existingInterview,
  onScheduled
}) => {
  const { toast } = useToast();
  const [date, setDate] = useState(
    existingInterview?.scheduledAt ? new Date(existingInterview.scheduledAt) : undefined
  );
  const [time, setTime] = useState(existingInterview?.scheduledAt
    ? format(new Date(existingInterview.scheduledAt), "HH:mm")
    : "10:00");
  const [duration, setDuration] = useState(String(existingInterview?.duration || 30));
  const [mode, setMode] = useState(existingInterview?.mode || "ONLINE");
  const [location, setLocation] = useState(existingInterview?.location || "");
  const [notes, setNotes] = useState(existingInterview?.notes || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!date) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }

    const [hours, minutes] = time.split(":").map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    if (scheduledAt <= new Date()) {
      toast(
        { title: "Interview must be scheduled in the future", variant: "destructive" }
      );
      return;
    }

    setSubmitting(true);
    try {
      await api("/interviews/schedule", {
        method: "POST",
        body: {
          applicationId,
          scheduledAt: scheduledAt.toISOString(),
          duration: parseInt(duration),
          mode,
          location: location || undefined,
          notes: notes || undefined,
        },
      });
      toast(
        { title: existingInterview ? "Interview Rescheduled!" : "Interview Scheduled!", description: `Interview with ${candidateName} has been set.` }
      );
      onScheduled();
      onOpenChange(false);
    } catch (err) {
      toast(
        { title: err.message || "Failed to schedule interview", variant: "destructive" }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {existingInterview ? "Reschedule Interview" : "Schedule Interview"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {candidateName} — {jobTitle}
          </p>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interview-time">Time *</Label>
              <Input
                id="interview-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interview-duration">Duration (min)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Interview Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ONLINE">Online (Video Call)</SelectItem>
                <SelectItem value="IN_PERSON">In Person</SelectItem>
                <SelectItem value="PHONE">Phone Call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interview-location">
              {mode === "ONLINE" ? "Meeting Link" : mode === "IN_PERSON" ? "Address" : "Phone Number"}
            </Label>
            <Input
              id="interview-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={mode === "ONLINE" ? "https://meet.google.com/..." : mode === "IN_PERSON" ? "Office address" : "+91 ..."} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interview-notes">Notes for Candidate</Label>
            <Textarea
              id="interview-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any preparation tips or details..."
              rows={2} />
          </div>
        </div>

        {existingInterview?.status === "RESCHEDULE_REQUESTED" && existingInterview.candidateMessage && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 mb-2">
            <p className="text-xs font-medium text-accent">Candidate's reschedule request:</p>
            <p className="text-sm text-foreground mt-1">"{existingInterview.candidateMessage}"</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existingInterview ? "Reschedule" : "Schedule Interview"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleInterviewDialog;
