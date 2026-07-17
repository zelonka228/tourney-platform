import { useEffect, useRef, useState } from "react";

// Оборгортка для картки фіксованого розміру (TeamCard, 320px завширшки) —
// зменшує її через CSS transform:scale, якщо доступна ширина контейнера
// менша за природну ширину дитини. На мобільних екранах TeamCard інакше
// вилазить за краї панелі: усі текстові оверлеї всередині позиціоновані в
// пікселях (не у відсотках), тож просте звуження ширини контейнера зламало
// б верстку (текст лишився б того самого розміру, а фон стиснувся б) —
// scale() масштабує все разом і зберігає пропорції.
//
// Висота НЕ передається пропом і не хардкодиться (320×600 — це лише сама
// картка): TeamCard рендерить під собою ще підказку "клікни, щоб
// перевернути", і ця висота залежить від того, розкритий пак чи ні. Якщо
// зарезервувати місце тільки під 600px картки, ця підказка вилазить за межі
// обгортки й перекриває наступний елемент (кнопку "Завантажити PNG" —
// це саме так і сталось). Тому inner-вузол міряється власним
// ResizeObserver'ом (offsetHeight ДО масштабування), і саме цей реальний
// розмір, помножений на scale, віддається назовні як висота обгортки.
export function ScaleToFit({ width, children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      setScale(Math.min(1, outer.offsetWidth / width));
      setNaturalHeight(inner.offsetHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={outerRef}
      style={{ width: "100%", height: naturalHeight * scale, display: "flex", justifyContent: "center" }}
    >
      <div ref={innerRef} style={{ width, transform: `scale(${scale})`, transformOrigin: "top center" }}>
        {children}
      </div>
    </div>
  );
}
