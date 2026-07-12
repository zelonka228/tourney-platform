import { Navigate, useNavigate } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { Btn, Overline, Panel } from "../components/arena";

export function Account() {
  const { t } = useI18n();
  const { user, isAdmin, logout, loading } = useAuth();
  const nav = useNavigate();

  // AuthProvider validates the stored token against GET /api/auth/me on
  // mount — while that's in flight `user` is still null even for a logged-in
  // visitor. Redirecting on `!user` alone bounced a valid session straight
  // back to /login on every direct load/refresh of this page.
  if (loading) return <div className="py-20 text-center overline">…</div>;
  if (!user) return <Navigate to="/login" replace />;

  function handleLogout() {
    logout();
    nav("/");
  }

  return (
    <div className="py-16 flex justify-center" data-testid="account-page">
      <div className="w-full max-w-sm">
        <Overline className="text-cyan text-center">// {t("auth.account")}</Overline>
        <h1 className="font-display font-black text-3xl tracking-tighter text-white mt-3 text-center">
          {user.username}
        </h1>

        <Panel clip className="p-6 mt-8 text-center">
          <span
            className={`inline-block px-3 py-1 text-xs font-mono uppercase tracking-widest rounded-sm border ${
              isAdmin ? "border-volt text-volt bg-volt/10" : "border-[#27272a] text-[#a1a1aa]"
            }`}
            data-testid="account-role-badge"
          >
            {isAdmin ? t("auth.role.admin") : t("auth.role.user")}
          </span>

          <p className="text-[#a1a1aa] text-sm mt-5">{t("auth.readOnlyNotice")}</p>

          <Btn
            variant="ghost"
            className="w-full mt-6"
            data-testid="logout-btn"
            onClick={handleLogout}
          >
            {t("auth.signOut")}
          </Btn>
        </Panel>
      </div>
    </div>
  );
}
