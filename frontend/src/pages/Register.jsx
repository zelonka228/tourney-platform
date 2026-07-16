import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { Btn, Field, Input, Overline, Panel } from "../components/arena";
import { PasswordStrength } from "../components/PasswordStrength";

export function Register() {
  const { t } = useI18n();
  const { register } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await register(username, password);
      nav("/account");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="py-16 flex justify-center" data-testid="register-page">
      <div className="w-full max-w-sm">
        <Overline className="text-cyan text-center">// {t("brand")}</Overline>
        <h1 className="font-display font-black text-3xl tracking-tighter text-white mt-3 text-center">
          {t("auth.register")}
        </h1>

        <Panel clip className="p-6 mt-8">
          <form onSubmit={handleSubmit}>
            <Field label={t("auth.username")}>
              <Input
                value={username}
                autoFocus
                data-testid="register-username-input"
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field label={t("auth.password")}>
              <Input
                type="password"
                value={password}
                data-testid="register-password-input"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <PasswordStrength password={password} />
            <div className="mt-4">
              <Field label={t("auth.confirmPassword")}>
                <Input
                  type="password"
                  value={confirm}
                  data-testid="register-confirm-input"
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
            </div>
            <Btn
              type="submit"
              variant="primary"
              className="w-full mt-2"
              disabled={submitting}
              data-testid="register-submit-btn"
            >
              {submitting ? t("auth.submitting") : t("auth.register")}
            </Btn>
            {error && (
              <p className="text-[#ff0055] text-sm mt-3 text-center" data-testid="register-error">
                {error}
              </p>
            )}
          </form>
          <p className="text-[#a1a1aa] text-sm text-center mt-5">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link to="/login" className="text-cyan hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </Panel>
      </div>
    </div>
  );
}
