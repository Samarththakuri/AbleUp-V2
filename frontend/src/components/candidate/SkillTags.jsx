import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X, Tags } from "lucide-react";

const SkillTags = ({
  skills,
  onUpdate,
  editable = true
}) => {
  const [newSkill, setNewSkill] = useState("");

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onUpdate([...skills, trimmed]);
      setNewSkill("");
    }
  };

  const removeSkill = (skill) => {
    onUpdate(skills.filter((s) => s !== skill));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <Tags className="h-5 w-5 text-primary" aria-hidden="true" />
        <CardTitle className="text-base">Skills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {skills.length === 0 && (
            <p className="text-sm text-muted-foreground">No skills added yet.</p>
          )}
          {skills.map((skill) => (
            <Badge key={skill} variant="secondary" className="gap-1 pr-1">
              {skill}
              {editable && (
                <button
                  onClick={() => removeSkill(skill)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${skill}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        {editable && (
          <div className="flex gap-2">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add a skill..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
            <Button
              size="sm"
              variant="outline"
              onClick={addSkill}
              disabled={!newSkill.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SkillTags;
