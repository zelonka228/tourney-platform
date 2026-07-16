import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { adminListUsers, adminUpdateUser, adminResetPassword, adminDeleteUser } from "../lib/api";
import { readCroppedImage } from "../lib/cropImage";
import { PasswordStrength } from "../components/PasswordStrength";
import { Btn, Field, Input, Overline, Panel, Select, Textarea } from "../components/arena";

const ROLE_VALUES = ["admin", "organizer", "user"];
const BIO_MAX_LEN = 500;

function EditRow({ target, onSaved, onCancel }) {
  const { t } = useI18n();
  const [username, setUsername] = useState(target.username);
  const [role, setRole] = useState(target.role);
  const [bio, setBio] = useState(target.bio ?? "");
  const [avatar, setAvatar] = useState(target.avatar ?? null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setAvatar(await readCroppedImage(file));
    } catch (err) {
      setError(err.message);
    }
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const updated = await adminUpdateUser(target.id, { username, role, bio, avatar });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#27272a]" data-testid={`admin-user-edit-${target.id}`}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label={t("auth.username")}>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label={t("admin.users.role")}>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_VALUES.map((r) => (
              <option key={r} value={r}>
                {t(`auth.role.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("account.bio")}>
        <Textarea
          rows={3}
          maxLength={BIO_MAX_LEN}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </Field>
      <Field label={t("account.avatar")}>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full border border-[#27272a] bg-void grid place-items-center overflow-hidden shrink-0">
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="w-4 h-4 border border-cyan/30 rotate-45" />
            )}
          </div>
          <input type="file" accept="image/*" id={`avatar-${target.id}`} className="sr-only" onChange={handleAvatarChange} />
          <label
            htmlFor={`avatar-${target.id}`}
            className="px-4 py-2 text-xs font-sans uppercase tracking-wider border border-[#3f3f46] rounded-sm cursor-pointer hover:border-cyan hover:text-cyan transition-colors"
          >
            {avatar ? t("team.change") : t("team.upload")}
          </label>
        </div>
      </Field>
      <div className="flex gap-2 mt-2">
        <Btn variant="primary" size="sm" disabled={saving} data-testid={`admin-user-save-${target.id}`} onClick={save}>
          {saving ? t("account.saving") : t("account.save")}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={onCancel}>
          {t("admin.users.cancel")}
        </Btn>
      </div>
      {error && <p className="text-[#ff0055] text-xs mt-2">{error}</p>}
    </div>
  );
}

function ResetPasswordRow({ target, onDone, onCancel }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await adminResetPassword(target.id, password);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#27272a]" data-testid={`admin-user-reset-${target.id}`}>
      <Field label={t("admin.users.newPassword")}>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <PasswordStrength password={password} />
      <div className="flex gap-2 mt-4">
        <Btn variant="primary" size="sm" disabled={saving} data-testid={`admin-user-reset-confirm-${target.id}`} onClick={submit}>
          {saving ? t("account.saving") : t("admin.users.resetConfirm")}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={onCancel}>
          {t("admin.users.cancel")}
        </Btn>
      </div>
      {error && <p className="text-[#ff0055] text-xs mt-2">{error}</p>}
    </div>
  );
}

export function AdminUsers() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState(null);
  const [listError, setListError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [rowError, setRowError] = useState({});

  useEffect(() => {
    if (!isAdmin) return;
    adminListUsers()
      .then(setUsers)
      .catch((err) => setListError(err.message));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="py-10" data-testid="admin-users-admin-only">
        <Overline className="text-cyan">// {t("account.manageUsers")}</Overline>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-3">
          {t("account.manageUsers")}
        </h1>
        <Panel clip className="p-6 mt-8 max-w-md">
          <p className="text-[#a1a1aa] text-sm">{t("auth.adminOnly")}</p>
          <Link to="/login" className="block mt-4 text-cyan text-sm hover:underline">
            {t("auth.signInToEdit")}
          </Link>
        </Panel>
      </div>
    );
  }

  function replaceUser(updated) {
    setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    setEditingId(null);
  }

  async function handleDelete(id) {
    if (!window.confirm(t("admin.users.confirmDelete"))) return;
    setRowError((m) => ({ ...m, [id]: null }));
    try {
      await adminDeleteUser(id);
      setUsers((list) => list.filter((u) => u.id !== id));
    } catch (err) {
      setRowError((m) => ({ ...m, [id]: err.message }));
    }
  }

  return (
    <div className="py-10" data-testid="admin-users-page">
      <Overline className="text-cyan">// {t("account.manageUsers")}</Overline>
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-3">
        {t("account.manageUsers")}
      </h1>

      {listError && <p className="text-[#ff0055] text-sm mt-4">{listError}</p>}

      <div className="grid gap-4 mt-8">
        {users?.map((u) => (
          <Panel clip className="p-5" key={u.id} data-testid={`admin-user-row-${u.id}`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <span className="font-display font-bold text-white">{u.username}</span>
                <span className="ml-3 text-xs font-mono uppercase tracking-widest text-[#a1a1aa]">
                  {t(`auth.role.${u.role}`)}
                </span>
                <p className="text-[#52525b] text-xs mt-1">
                  {t("admin.users.registered")} {new Date(u.createdAt).toLocaleDateString()}
                  {u.bio ? ` · ${t("admin.users.hasBio")}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Btn
                  size="sm"
                  variant="ghost"
                  data-testid={`admin-user-edit-btn-${u.id}`}
                  onClick={() => {
                    setEditingId(editingId === u.id ? null : u.id);
                    setResettingId(null);
                  }}
                >
                  {t("admin.users.edit")}
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  data-testid={`admin-user-reset-btn-${u.id}`}
                  onClick={() => {
                    setResettingId(resettingId === u.id ? null : u.id);
                    setEditingId(null);
                  }}
                >
                  {t("admin.users.resetPassword")}
                </Btn>
                <Btn
                  size="sm"
                  variant="danger"
                  data-testid={`admin-user-delete-btn-${u.id}`}
                  onClick={() => handleDelete(u.id)}
                >
                  {t("admin.users.delete")}
                </Btn>
              </div>
            </div>
            {rowError[u.id] && <p className="text-[#ff0055] text-xs mt-2">{rowError[u.id]}</p>}
            {editingId === u.id && (
              <EditRow target={u} onSaved={replaceUser} onCancel={() => setEditingId(null)} />
            )}
            {resettingId === u.id && (
              <ResetPasswordRow
                target={u}
                onDone={() => setResettingId(null)}
                onCancel={() => setResettingId(null)}
              />
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
