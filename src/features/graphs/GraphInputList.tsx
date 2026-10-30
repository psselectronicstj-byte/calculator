import type { GraphExpression } from "./graph-types";

type GraphInputListProps = {
  expressions: GraphExpression[];
  onChange: (expressions: GraphExpression[]) => void;
};

const colors = ["#79d7a4", "#86b6ff", "#ffba78", "#d9a1ff", "#ff8e9b"];

function createExpression(expression = ""): GraphExpression {
  return {
    id: crypto.randomUUID(),
    expression,
    color: colors[0],
  };
}

export function GraphInputList({ expressions, onChange }: GraphInputListProps) {
  const updateExpression = (id: string, value: string) => {
    onChange(expressions.map((item) => item.id === id ? { ...item, expression: value } : item));
  };

  const removeExpression = (id: string) => {
    if (expressions.length > 1) {
      onChange(expressions.filter((item) => item.id !== id));
    }
  };

  const addExpression = () => {
    onChange([...expressions, { ...createExpression(), color: colors[expressions.length % colors.length] }]);
  };

  return (
    <fieldset className="graph-input-list" aria-label="Функции графика">
      <legend>Функции графика</legend>
      {expressions.map((item, index) => (
        <div className="graph-input-list__row" key={item.id}>
          <label className="angle-select">
            <span>Функция {index + 1}</span>
            <input
              aria-label={`Функция ${index + 1}`}
              value={item.expression}
              onChange={(event) => updateExpression(item.id, event.currentTarget.value)}
            />
          </label>
          <span className="graph-input-list__swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <button
            className="button button--quiet"
            type="button"
            aria-label={`Удалить функцию ${index + 1}`}
            disabled={expressions.length === 1}
            onClick={() => removeExpression(item.id)}
          >
            Удалить
          </button>
        </div>
      ))}
      <button className="button button--quiet" type="button" onClick={addExpression}>
        Добавить функцию
      </button>
    </fieldset>
  );
}
