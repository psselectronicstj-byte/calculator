const keys = [
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "÷", value: "/" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "×", value: "*" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "−", value: "-" },
  { label: "0", value: "0" },
  { label: ".", value: "." },
  { label: "(", value: "(" },
  { label: ")", value: ")" },
  { label: "+", value: "+" },
  { label: "^", value: "^" },
  { label: "π", value: "pi" },
  { label: "e", value: "e" },
  { label: "sin", value: "sin(" },
  { label: "cos", value: "cos(" },
  { label: "tan", value: "tan(" },
  { label: "√", value: "sqrt(" },
  { label: "log", value: "log(" },
  { label: "ln", value: "ln(" },
  { label: "abs", value: "abs(" },
];

type KeypadProps = {
  onInsert: (value: string) => void;
};

export function Keypad({ onInsert }: KeypadProps) {
  return (
    <div className="keypad" aria-label="Математическая клавиатура">
      {keys.map(({ label, value }) => (
        <button
          key={value}
          aria-label={`Вставить ${label}`}
          className="keypad__key"
          type="button"
          onClick={() => onInsert(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
