// Проста pulse-заглушка на час першого завантаження списку — щоб замість
// порожнього екрана (чи стрибка вмісту, коли дані таки прийшли) було видно
// приблизний силует того, що зараз з'явиться.
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-[#27272a] rounded-sm ${className}`} />;
}
