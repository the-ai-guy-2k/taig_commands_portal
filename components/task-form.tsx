"use client";

import { fieldIssue } from "@/lib/coverage/present";
import type { FormFieldView, ValidationView } from "@/lib/portal/types";

export function TaskForm({
  taskId,
  fields,
  values,
  validation,
  busy,
  onChange,
  onGenerate,
}: {
  taskId: string;
  fields: readonly FormFieldView[];
  values: Readonly<Record<string, string>>;
  validation: ValidationView | null;
  busy: boolean;
  onChange: (inputKey: string, value: string) => void;
  onGenerate: () => void;
}) {
  return (
    <form
      className="task-form"
      onSubmit={(event) => {
        event.preventDefault();
        onGenerate();
      }}
    >
      <h3>Required inputs</h3>
      <p className="field-note">
        Fields come from the task input contract. Examples are research help text. They are not filled in as your
        values. This form does not check Cisco address, VLAN, or interface grammar.
      </p>
      {fields.map((field) => {
        const issue = fieldIssue(validation, field.inputKey);
        const describedBy = [`${fieldId(taskId, field.inputKey)}-help`];
        if (issue) {
          describedBy.push(`${fieldId(taskId, field.inputKey)}-error`);
        }
        return (
          <div className="field" key={field.inputKey}>
            <label htmlFor={fieldId(taskId, field.inputKey)}>
              {field.description} <code>{field.inputKey}</code>
              {field.requirement === "required" ? <span className="req"> Required</span> : <span> Optional</span>}
            </label>
            <input
              id={fieldId(taskId, field.inputKey)}
              name={field.inputKey}
              type="text"
              autoComplete="off"
              value={values[field.inputKey] ?? ""}
              aria-invalid={Boolean(issue)}
              aria-describedby={describedBy.join(" ")}
              onChange={(event) => onChange(field.inputKey, event.target.value)}
            />
            <p id={`${fieldId(taskId, field.inputKey)}-help`} className="field-note">
              Example from the research package: {field.exampleValue}. This is not your input.
              {field.range ? ` Recorded range note: ${field.range}.` : ""}
            </p>
            {issue ? (
              <p id={`${fieldId(taskId, field.inputKey)}-error`} className="field-error">
                {issue.message}
              </p>
            ) : null}
          </div>
        );
      })}
      <button
        id="generate-procedure"
        type="submit"
        disabled={busy}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          onGenerate();
        }}
      >
        {busy ? "Generating procedure" : "Generate procedure"}
      </button>
    </form>
  );
}

function fieldId(taskId: string, inputKey: string): string {
  return `field-${taskId}-${inputKey}`;
}
