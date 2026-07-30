import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { COMPANY_ACCESSIBILITY_FACILITIES } from "@/constants/company";

/**
 * Company-wide accessibility facilities (spec §7).
 *
 * These describe the workplace itself and live on the RecruiterProfile;
 * individual jobs can still declare extra, job-specific accessibility.
 * Shared by the onboarding wizard and the recruiter profile page.
 */
const AccessibilityFacilitiesPicker = ({
  value,
  onChange,
  disabled,
  hint
}) => {
  const toggle = (facility, checked) => {
    onChange(checked
      ? [...value, facility]
      : value.filter((f) => f !== facility));
  };

  return (
    <fieldset
      className="space-y-3"
      aria-describedby={hint ? "accessibility-hint" : undefined}>
      <legend className="sr-only">Company accessibility facilities</legend>
      {hint && (
        <p id="accessibility-hint" className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {COMPANY_ACCESSIBILITY_FACILITIES.map((facility) => {
          const id = `facility-${facility.replace(/\s+/g, "-").toLowerCase()}`;
          const checked = value.includes(facility);

          return (
            <div
              key={facility}
              className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
              <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(state) => toggle(facility, state === true)} />
              <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug">
                {facility}
              </Label>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {value.length} of {COMPANY_ACCESSIBILITY_FACILITIES.length} selected
      </p>
    </fieldset>
  );
};

export default AccessibilityFacilitiesPicker;
