import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MatrixEditor } from "./MatrixEditor";

describe("MatrixEditor", () => {
  it("exposes a labelled multiline editor and reports text changes", () => {
    const onChange = vi.fn();
    render(<MatrixEditor label="Матрица A" value="1, 2" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Матрица A"), { target: { value: "1, 2\n3, 4" } });

    expect(onChange).toHaveBeenCalledWith("1, 2\n3, 4");
    expect(screen.getByLabelText("Матрица A")).toHaveAttribute("rows", "4");
  });
});
