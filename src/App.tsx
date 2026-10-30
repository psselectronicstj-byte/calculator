export default function App() {
  return (
    <main className="instrument">
      <header className="instrument__header">
        <div className="instrument__mark" aria-hidden="true">∑</div>
        <div>
          <h1>Математический прибор</h1>
          <p>Вычисления останутся на этом устройстве</p>
        </div>
      </header>
      <section className="instrument__screen" aria-labelledby="screen-title">
        <p className="instrument__eyebrow">Рабочая область</p>
        <h2 id="screen-title">Формулы — в фокусе</h2>
        <p>Калькулятор и инструменты появятся здесь по мере сборки приложения.</p>
      </section>
    </main>
  );
}
