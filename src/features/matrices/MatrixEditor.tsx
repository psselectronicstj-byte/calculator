type MatrixEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function MatrixEditor({ label, value, onChange }: MatrixEditorProps) {
  return (
    <label className="matrix-editor">
      <span>{label}</span>
      <textarea
        aria-label={label}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        rows={4}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span className="matrix-editor__hint">Строки — с новой строки; элементы разделяйте запятой или пробелом.</span>
    </label>
  );
}
