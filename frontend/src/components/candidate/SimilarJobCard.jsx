import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, IndianRupee } from "lucide-react";

const SimilarJobCard = ({
  job
}) => {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/jobs/${job._id}`)}>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground line-clamp-1">{job.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="gap-1 text-xs">
            <MapPin className="h-3 w-3" />
            {job.location || (job.remote ? "Remote" : "On-site")}
          </Badge>
          {job.salaryMin && job.salaryMax && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <IndianRupee className="h-3 w-3" />
              ₹{job.salaryMin.toLocaleString()} - ₹{job.salaryMax.toLocaleString()}
            </Badge>
          )}
        </div>
        {job.disabilityEligible && job.disabilityEligible.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {job.disabilityEligible.slice(0, 2).map((d) => (
              <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
            ))}
            {job.disabilityEligible.length > 2 && (
              <Badge variant="outline" className="text-xs">+{job.disabilityEligible.length - 2}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimilarJobCard;
