import { forwardRef } from "react";

type MathEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

export const MathEditor = forwardRef<HTMLTextAreaElement, MathEditorProps>(
  function MathEditor({ value, onChange, onKeyDown }, ref) {
    return (
      <label className="math-editor">
        <span>Выражение</span>
        <textarea
          ref={ref}
          aria-label="Математическое выражение"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          rows={2}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
      </label>
    );
  },
);
