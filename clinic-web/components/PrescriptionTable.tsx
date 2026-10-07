"use client";

import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { FieldErrorText } from "@/components/FieldErrorText";
import type { ConsultationFormValues } from "@/lib/consultationSchema";

interface PrescriptionTableProps {
  control: Control<ConsultationFormValues>;
  register: UseFormRegister<ConsultationFormValues>;
  errors: FieldErrors<ConsultationFormValues>;
  readOnly: boolean;
}

const TIMING_OPTIONS: { value: string; label: string }[] = [
  { value: "BEFORE_FOOD", label: "Before food" },
  { value: "AFTER_FOOD", label: "After food" },
  { value: "BEDTIME", label: "Bedtime" },
  { value: "AS_NEEDED", label: "As needed" },
];

export function PrescriptionTable({ control, register, errors, readOnly }: PrescriptionTableProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "prescription" });

  return (
    <div>
      <div className="table-wrap">
        <table className="rx-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Strength</th>
              <th>Dosage (m-a-n)</th>
              <th>Timing</th>
              <th>Days</th>
              <th>Instructions</th>
              {!readOnly && <th></th>}
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const itemErrors = errors.prescription?.[index];
              return (
                <tr key={field.id}>
                  <td>
                    <input type="text" disabled={readOnly} {...register(`prescription.${index}.medicineName`)} />
                    <FieldErrorText message={itemErrors?.medicineName?.message} />
                  </td>
                  <td>
                    <input type="text" disabled={readOnly} {...register(`prescription.${index}.strength`)} />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="1-0-1"
                      disabled={readOnly}
                      {...register(`prescription.${index}.dosagePattern`)}
                    />
                    <FieldErrorText message={itemErrors?.dosagePattern?.message} />
                  </td>
                  <td>
                    <select disabled={readOnly} {...register(`prescription.${index}.timing`)}>
                      {TIMING_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      disabled={readOnly}
                      {...register(`prescription.${index}.durationDays`)}
                    />
                    <FieldErrorText message={itemErrors?.durationDays?.message} />
                  </td>
                  <td>
                    <input type="text" disabled={readOnly} {...register(`prescription.${index}.instructions`)} />
                  </td>
                  {!readOnly && (
                    <td>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(index)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {fields.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 6 : 7} className="empty-state">
                  No medicines added.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {typeof errors.prescription?.message === "string" && (
        <FieldErrorText message={errors.prescription.message} />
      )}
      {!readOnly && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginTop: "0.75rem" }}
          disabled={fields.length >= 20}
          onClick={() =>
            append({
              medicineName: "",
              strength: "",
              dosagePattern: "1-0-1",
              timing: "AFTER_FOOD",
              durationDays: 5,
              instructions: "",
            })
          }
        >
          + Add medicine
        </button>
      )}
    </div>
  );
}
