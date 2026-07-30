import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMPANY_SIZES, COMPANY_SIZE_LABELS, INDUSTRIES } from "@/constants/company";

const FieldError = ({
  id,
  message
}) =>
  message ? (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  ) : null;

/** Company name, industry, size, website, description, founded year. */
export const CompanyBasicsFields = ({
  values,
  onChange,
  errors = {},
  disabled
}) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="companyName">Company Name *</Label>
      <Input
        id="companyName"
        value={values.companyName || ""}
        onChange={(e) => onChange("companyName", e.target.value)}
        aria-invalid={!!errors.companyName}
        aria-describedby={errors.companyName ? "companyName-error" : undefined}
        disabled={disabled}
        required />
      <FieldError id="companyName-error" message={errors.companyName} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="industry">Industry *</Label>
        <Select
          value={values.industry || ""}
          onValueChange={(v) => onChange("industry", v)}
          disabled={disabled}>
          <SelectTrigger id="industry" aria-invalid={!!errors.industry}>
            <SelectValue placeholder="Select industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="industry-error" message={errors.industry} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="companySize">Company Size *</Label>
        <Select
          value={values.companySize || ""}
          onValueChange={(v) => onChange("companySize", v)}
          disabled={disabled}>
          <SelectTrigger id="companySize" aria-invalid={!!errors.companySize}>
            <SelectValue placeholder="Select size" />
          </SelectTrigger>
          <SelectContent>
            {COMPANY_SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {COMPANY_SIZE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="companySize-error" message={errors.companySize} />
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          placeholder="example.com"
          value={values.website || ""}
          onChange={(e) => onChange("website", e.target.value)}
          aria-invalid={!!errors.website}
          disabled={disabled} />
        <FieldError id="website-error" message={errors.website} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="foundedYear">Founded Year</Label>
        <Input
          id="foundedYear"
          type="number"
          inputMode="numeric"
          min={1800}
          max={new Date().getFullYear()}
          value={values.foundedYear ?? ""}
          onChange={(e) =>
            onChange("foundedYear", e.target.value ? Number(e.target.value) : undefined)
          }
          disabled={disabled} />
        <FieldError id="foundedYear-error" message={errors.foundedYear} />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="companyDescription">Company Description *</Label>
      <Textarea
        id="companyDescription"
        rows={5}
        placeholder="Tell candidates what your company does and how you support inclusive hiring."
        value={values.companyDescription || ""}
        onChange={(e) => onChange("companyDescription", e.target.value)}
        aria-invalid={!!errors.companyDescription}
        aria-describedby="companyDescription-hint"
        disabled={disabled} />
      <p id="companyDescription-hint" className="text-xs text-muted-foreground">
        At least 30 characters. {(values.companyDescription || "").length} entered.
      </p>
      <FieldError id="companyDescription-error" message={errors.companyDescription} />
    </div>
  </div>
);

/** HR contact person, phone, company email, LinkedIn, and address. */
export const CompanyContactFields = ({
  values,
  onChange,
  errors = {},
  disabled
}) => (
  <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="hrContactPerson">HR Contact Person *</Label>
        <Input
          id="hrContactPerson"
          value={values.hrContactPerson || ""}
          onChange={(e) => onChange("hrContactPerson", e.target.value)}
          aria-invalid={!!errors.hrContactPerson}
          disabled={disabled}
          required />
        <FieldError id="hrContactPerson-error" message={errors.hrContactPerson} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hrContactNumber">HR Contact Number *</Label>
        <Input
          id="hrContactNumber"
          type="tel"
          placeholder="+91 98200 12345"
          value={values.hrContactNumber || ""}
          onChange={(e) => onChange("hrContactNumber", e.target.value)}
          aria-invalid={!!errors.hrContactNumber}
          disabled={disabled}
          required />
        <FieldError id="hrContactNumber-error" message={errors.hrContactNumber} />
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="companyEmail">Company Email</Label>
        <Input
          id="companyEmail"
          type="email"
          placeholder="careers@example.com"
          value={values.companyEmail || ""}
          onChange={(e) => onChange("companyEmail", e.target.value)}
          aria-invalid={!!errors.companyEmail}
          disabled={disabled} />
        <FieldError id="companyEmail-error" message={errors.companyEmail} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="linkedin">LinkedIn</Label>
        <Input
          id="linkedin"
          placeholder="linkedin.com/company/..."
          value={values.linkedin || ""}
          onChange={(e) => onChange("linkedin", e.target.value)}
          aria-invalid={!!errors.linkedin}
          disabled={disabled} />
        <FieldError id="linkedin-error" message={errors.linkedin} />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="companyAddress">Address</Label>
      <Input
        id="companyAddress"
        value={values.companyAddress || ""}
        onChange={(e) => onChange("companyAddress", e.target.value)}
        disabled={disabled} />
    </div>

    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          value={values.city || ""}
          onChange={(e) => onChange("city", e.target.value)}
          disabled={disabled} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="state">State</Label>
        <Input
          id="state"
          value={values.state || ""}
          onChange={(e) => onChange("state", e.target.value)}
          disabled={disabled} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          value={values.country || ""}
          onChange={(e) => onChange("country", e.target.value)}
          disabled={disabled} />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="gstNumber">GST Number</Label>
      <Input
        id="gstNumber"
        value={values.gstNumber || ""}
        onChange={(e) => onChange("gstNumber", e.target.value)}
        aria-describedby="gstNumber-hint"
        disabled={disabled} />
      <p id="gstNumber-hint" className="text-xs text-muted-foreground">
        Optional. Helps admins verify your company faster.
      </p>
    </div>
  </div>
);
