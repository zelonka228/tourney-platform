import { useEffect, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { updateMe } from "../lib/api";
import { readCroppedImage } from "../lib/cropImage";
import { Btn, Overline, Panel, Textarea } from "../components/arena";

const BIO_MAX_LEN = 500;
const ROLE_BADGE = {
  admin: "border-volt text-volt bg-volt/10",
  organizer: "border-cyan text-cyan bg-cyan/10",
  user: "border-[#27272a] text-[#a1a1aa]",
};

export function Account() {
  const { t } = useI18n();
  const { user, setUser, isAdmin, logout, loading } = useAuth();
  const nav = useNavigate();
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [avatarError, setAvatarError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setBio(user.bio ?? "");
      setAvatar(user.avatar ?? null);
    }
  }, [user]);

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

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    try {
      setAvatar(await readCroppedImage(file));
    } catch (err) {
      setAvatarError(err.message);
    }
  }

  async function save() {
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await updateMe({ bio, avatar });
      setUser(res.user);
      setSaved(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
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
            className={`inline-block px-3 py-1 text-xs font-mono uppercase tracking-widest rounded-sm border ${ROLE_BADGE[user.role] ?? ROLE_BADGE.user}`}
            data-testid="account-role-badge"
          >
            {t(`auth.role.${user.role}`)}
          </span>

          <div className="mt-6 text-left">
            <div className="mx-auto w-20 h-20 rounded-full border border-[#27272a] bg-void grid place-items-center overflow-hidden">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-6 h-6 border border-cyan/30 rotate-45" />
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              id="avatar-input"
              className="sr-only"
              onChange={handleAvatarChange}
            />
            <label
              htmlFor="avatar-input"
              data-testid="account-avatar-upload"
              className="mt-3 block text-center px-4 py-2 text-xs font-sans uppercase tracking-wider border border-[#3f3f46] rounded-sm cursor-pointer hover:border-cyan hover:text-cyan transition-colors"
            >
              {avatar ? t("team.change") : t("team.upload")}
            </label>
            {avatarError && <p className="text-[#ff0055] text-xs mt-2">{avatarError}</p>}

            <div className="mt-5">
              <span className="overline block mb-2">{t("account.bio")}</span>
              <Textarea
                rows={4}
                maxLength={BIO_MAX_LEN}
                value={bio}
                data-testid="account-bio-input"
                onChange={(e) => setBio(e.target.value)}
              />
              <p className="text-[#52525b] text-xs mt-1 text-right">
                {bio.length}/{BIO_MAX_LEN}
              </p>
            </div>
          </div>

          <Btn
            variant="primary"
            className="w-full mt-2"
            disabled={saving}
            data-testid="account-save-btn"
            onClick={save}
          >
            {saving ? t("account.saving") : t("account.save")}
          </Btn>
          {saveError && (
            <p className="text-[#ff0055] text-sm mt-3" data-testid="account-save-error">
              {saveError}
            </p>
          )}
          {saved && !saveError && (
            <p className="text-cyan text-sm mt-3" data-testid="account-save-success">
              {t("account.saved")}
            </p>
          )}

          {isAdmin && (
            <Link to="/admin/users" data-testid="account-manage-users-link">
              <Btn variant="ghost" className="w-full mt-6">
                {t("account.manageUsers")}
              </Btn>
            </Link>
          )}

          <p className="text-[#a1a1aa] text-sm mt-5">{t("auth.readOnlyNotice")}</p>

          <Btn variant="ghost" className="w-full mt-3" data-testid="logout-btn" onClick={handleLogout}>
            {t("auth.signOut")}
          </Btn>
        </Panel>
      </div>
    </div>
  );
}
