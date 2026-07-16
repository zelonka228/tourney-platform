import { useI18n } from "../lib/i18n";
import { passwordStrength } from "../lib/password";

const LEVEL_KEY = ["auth.strength.weak", "auth.strength.weak", "auth.strength.medium", "auth.strength.strong"];
const LEVEL_COLOR = ["#ff0055", "#ff0055", "#dfff00", "#00f0ff"];

export function PasswordStrength({ password }) {
  const { t } = useI18n();
  const score = passwordStrength(password);

  return (
    <div className="mt-2" data-testid="password-strength">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-sm transition-colors"
            style={{ backgroundColor: password && i <= score ? LEVEL_COLOR[score] : "#27272a" }}
          />
        ))}
      </div>
      {password && (
        <p className="text-xs mt-1.5" style={{ color: LEVEL_COLOR[score] }}>
          {t(LEVEL_KEY[score])}
        </p>
      )}
      <ul className="text-xs text-[#71717a] mt-2 space-y-0.5 list-disc list-inside">
        <li>{t("auth.passwordHint.length")}</li>
        <li>{t("auth.passwordHint.special")}</li>
        <li>{t("auth.passwordHint.dictionary")}</li>
      </ul>
    </div>
  );
}
