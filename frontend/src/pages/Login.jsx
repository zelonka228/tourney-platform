import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { Btn, Field, Input, Overline, Panel } from "../components/arena";

export function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      nav(location.state?.from ?? "/account");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="py-16 flex justify-center" data-testid="login-page">
      <div className="w-full max-w-sm">
        <Overline className="text-cyan text-center">// {t("brand")}</Overline>
        <h1 className="font-display font-black text-3xl tracking-tighter text-white mt-3 text-center">
          {t("auth.signIn")}
        </h1>

        <Panel clip className="p-6 mt-8">
          <form onSubmit={handleSubmit}>
            <Field label={t("auth.username")}>
              <Input
                value={username}
                autoFocus
                data-testid="login-username-input"
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field label={t("auth.password")}>
              <Input
                type="password"
                value={password}
                data-testid="login-password-input"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Btn
              type="submit"
              variant="primary"
              className="w-full mt-2"
              disabled={submitting}
              data-testid="login-submit-btn"
            >
              {submitting ? t("auth.submitting") : t("auth.submit")}
            </Btn>
            {error && (
              <p className="text-[#ff0055] text-sm mt-3 text-center" data-testid="login-error">
                {error}
              </p>
            )}
          </form>
        </Panel>
      </div>
    </div>
  );
}
