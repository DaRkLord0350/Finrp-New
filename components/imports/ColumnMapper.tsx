"use client";

// ============================================================
// FinRP — Column Mapper
// Interactive drag-and-drop field mapping UI.
// Source: detected CSV/Excel headers (left)
// Target: FinRP field names (right)
// Supports auto-suggest, transforms preview, required field highlighting.
// ============================================================

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, ArrowRight, Wand2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MappingRule } from "@/lib/connectors/base/types";
import {
  CUSTOMER_TARGET_FIELDS,
  INVOICE_TARGET_FIELDS,
  PRODUCT_TARGET_FIELDS,
  buildDefaultRules,
} from "@/lib/mapping/engine";

// ---------------------------------------------------------------------------
// Target field definitions per entity
// ---------------------------------------------------------------------------

type TargetField = { field: string; label: string; required: boolean };

const ENTITY_TARGET_FIELDS: Record<string, TargetField[]> = {
  CUSTOMERS: CUSTOMER_TARGET_FIELDS,
  VENDORS: CUSTOMER_TARGET_FIELDS,
  INVOICES: INVOICE_TARGET_FIELDS,
  PRODUCTS: PRODUCT_TARGET_FIELDS,
  EMPLOYEES: [
    { field: "name", label: "Full Name", required: true },
    { field: "email", label: "Work Email", required: false },
    { field: "phone", label: "Phone", required: false },
    { field: "designation", label: "Job Title", required: false },
    { field: "department", label: "Department", required: false },
    { field: "dateOfJoining", label: "Date of Joining", required: false },
    { field: "dateOfBirth", label: "Date of Birth", required: false },
  ],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColumnMapperProps {
  sourceHeaders: string[];
  entity: string;
  suggestedMappings?: Record<string, string>;
  initialRules?: MappingRule[];
  onChange: (rules: MappingRule[]) => void;
  onSave?: (rules: MappingRule[]) => void;
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColumnMapper({
  sourceHeaders,
  entity,
  suggestedMappings = {},
  initialRules,
  onChange,
  onSave,
  isSaving = false,
}: ColumnMapperProps) {
  const targetFields = ENTITY_TARGET_FIELDS[entity.toUpperCase()] ?? CUSTOMER_TARGET_FIELDS;
  const targetFieldOptions = targetFields.map((f) => f.field);

  // mapping[sourceHeader] = targetField | "" (unmapped)
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    if (initialRules) {
      return Object.fromEntries(
        initialRules.map((r) => [r.sourceField, r.targetField])
      );
    }
    // Apply auto-suggestions
    const initial: Record<string, string> = {};
    for (const header of sourceHeaders) {
      initial[header] = suggestedMappings[header] ?? "";
    }
    return initial;
  });

  // Build MappingRule[] from current mapping state
  useEffect(() => {
    const rules = buildDefaultRules(
      sourceHeaders.filter((h) => mapping[h]),
      targetFieldOptions,
      mapping
    );
    onChange(rules);
  }, [mapping]); // eslint-disable-line react-hooks/exhaustive-deps

  function setFieldMapping(source: string, target: string) {
    setMapping((prev) => ({ ...prev, [source]: target }));
  }

  function autoMap() {
    const auto: Record<string, string> = { ...mapping };
    for (const header of sourceHeaders) {
      if (!auto[header] && suggestedMappings[header]) {
        auto[header] = suggestedMappings[header];
      }
    }
    setMapping(auto);
  }

  function clearAll() {
    setMapping(Object.fromEntries(sourceHeaders.map((h) => [h, ""])));
  }

  // Check coverage
  const requiredFields = targetFields.filter((f) => f.required);
  const mappedTargets = new Set(Object.values(mapping).filter(Boolean));
  const unmappedRequired = requiredFields.filter((f) => !mappedTargets.has(f.field));
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const isValid = unmappedRequired.length === 0;

  // Detect duplicate target mappings
  const duplicateTargets = (() => {
    const seen = new Map<string, number>();
    for (const v of Object.values(mapping)) {
      if (v) seen.set(v, (seen.get(v) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([k]) => k));
  })();

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Map Columns to Fields</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={autoMap}
              className="gap-1.5"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Auto-map
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>

        {/* Coverage summary */}
        <div className="flex items-center gap-3 mt-2">
          <div className="text-sm text-muted-foreground">
            {mappedCount} of {sourceHeaders.length} columns mapped
          </div>
          {isValid ? (
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              All required fields mapped
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1">
              <AlertCircle className="h-3 w-3" />
              {unmappedRequired.length} required field{unmappedRequired.length !== 1 ? "s" : ""} missing
            </Badge>
          )}
        </div>

        {/* Required fields reminder */}
        {unmappedRequired.length > 0 && (
          <div className="mt-2 text-xs text-amber-600">
            Required: {unmappedRequired.map((f) => f.label).join(", ")}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 px-6 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
          <span>SOURCE COLUMN (from file)</span>
          <span />
          <span>TARGET FIELD (FinRP)</span>
        </div>

        {/* Mapping rows */}
        <div className="divide-y">
          {sourceHeaders.map((header) => {
            const selectedTarget = mapping[header] ?? "";
            const isDuplicate = selectedTarget && duplicateTargets.has(selectedTarget);
            const isRequired = selectedTarget && requiredFields.some((f) => f.field === selectedTarget);
            const isMissed = !selectedTarget;

            return (
              <div
                key={header}
                className={cn(
                  "grid grid-cols-[1fr_auto_1fr] gap-3 px-6 py-3 items-center transition-colors",
                  "hover:bg-muted/20",
                  isDuplicate && "bg-amber-50/50"
                )}
              >
                {/* Source column */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="truncate font-mono text-sm text-foreground">
                    {header}
                  </div>
                  {isMissed && (
                    <Badge variant="outline" className="text-muted-foreground border-dashed shrink-0 text-xs">
                      unmapped
                    </Badge>
                  )}
                </div>

                {/* Arrow */}
                <ArrowRight className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  selectedTarget ? "text-primary" : "text-muted-foreground/30"
                )} />

                {/* Target dropdown */}
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedTarget}
                    onValueChange={(val) => setFieldMapping(header, val === "__none__" ? "" : val)}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 text-sm",
                        isDuplicate && "border-amber-400",
                        isRequired && "border-primary/50"
                      )}
                    >
                      <SelectValue placeholder="— Skip column —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">— Skip column —</span>
                      </SelectItem>
                      {targetFields.map((tf) => (
                        <SelectItem key={tf.field} value={tf.field}>
                          <span className="flex items-center gap-2">
                            {tf.label}
                            {tf.required && (
                              <span className="text-xs text-red-500">*</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {isDuplicate && (
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" aria-label="Duplicate mapping" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Save action */}
        {onSave && (
          <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isValid
                ? "Mapping looks good. Proceed to import."
                : "Map all required fields before continuing."}
            </p>
            <Button
              onClick={() => {
                const rules = buildDefaultRules(
                  sourceHeaders.filter((h) => mapping[h]),
                  targetFieldOptions,
                  mapping
                );
                onSave(rules);
              }}
              disabled={!isValid || isSaving || duplicateTargets.size > 0}
              size="sm"
            >
              {isSaving ? "Saving…" : "Start Import"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
