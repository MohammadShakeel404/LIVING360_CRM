"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2, KeyRound, Mail, Phone, UserCog, Trash2 } from "lucide-react";
import { Avatar, EmptyState, Field, PageHeader, inputCls, btn, formatDate } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";

type U = { id: string; name: string; email: string; phone: string | null; role: string; roleLabel: string; status: string; joiningDate: string; leads: number; tasks: number };
type Role = { value: string; label: string; discount: number };

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export function EmployeesClient({ users, roles, me, isSuperAdmin, canCreate, canEdit, canDelete }: { users: U[]; roles: Role[]; me: string; isSuperAdmin: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<U | "new" | null>(null);
  const filtered = useMemo(() => {
    const n = q.toLowerCase();
    return users.filter((u) => !n || u.name.toLowerCase().includes(n) || u.email.toLowerCase().includes(n) || u.roleLabel.toLowerCase().includes(n));
  }, [users, q]);
  const assignable = roles.filter((r) => isSuperAdmin || r.value !== "SUPER_ADMIN");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Employees"
        subtitle={`${users.filter((u) => u.status === "ACTIVE").length} active team members`}
        actions={canCreate ? <button onClick={() => setModal("new")} className={btn.primary}><Plus size={15} /> Add employee</button> : undefined}
      />
      <div className="flex items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5 focus-within:border-primary/50">
        <Search size={16} className="text-ink-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or role…" className="flex-1 bg-transparent text-[14px] outline-none" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-line bg-white"><EmptyState icon={UserCog} title="No employees found" note="Try a different search." /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => {
            const editable = canEdit && (isSuperAdmin || u.role !== "SUPER_ADMIN");
            return (
              <button
                key={u.id}
                disabled={!editable}
                onClick={() => setModal(u)}
                className={`rounded-xl2 border border-line bg-white p-4 text-left transition-shadow ${editable ? "hover:shadow-[0_4px_16px_rgba(37,26,81,0.07)]" : ""} ${u.status === "INACTIVE" ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={u.name} size={42} tone={u.status === "ACTIVE" ? "bg-primary" : "bg-ink-faint"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14.5px] font-semibold text-ink">{u.name}{u.id === me ? " (you)" : ""}</span>
                      {u.status === "INACTIVE" && <span className="rounded-full bg-line-soft px-2 py-0.5 text-[10.5px] font-bold text-ink-faint">INACTIVE</span>}
                    </div>
                    <div className="text-[12.5px] font-medium text-primary">{u.roleLabel}</div>
                    <div className="mt-1.5 flex flex-col gap-0.5 text-[12px] text-ink-soft">
                      <span className="flex items-center gap-1.5 truncate"><Mail size={12} /> {u.email}</span>
                      {u.phone && <span className="flex items-center gap-1.5"><Phone size={12} /> {u.phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-between border-t border-line-soft pt-2.5 text-[11.5px] text-ink-faint">
                  <span>Joined {formatDate(u.joiningDate)}</span>
                  <span>{u.leads} leads · {u.tasks} tasks</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {modal && <EmployeeModal user={modal === "new" ? null : modal} roles={assignable} me={me} canDelete={canDelete} onClose={() => setModal(null)} />}
    </div>
  );
}

function EmployeeModal({ user, roles, me, canDelete, onClose }: { user: U | null; roles: Role[]; me: string; canDelete: boolean; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", role: user?.role ?? "SALES_EXECUTIVE", status: user?.status ?? "ACTIVE", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const self = user?.id === me;
  const role = roles.find((r) => r.value === f.role);

  async function save() {
    setBusy(true);
    try {
      if (user) {
        await call(`/api/employees/${user.id}`, "PATCH", { name: f.name, phone: f.phone, role: f.role, status: f.status, ...(f.password ? { password: f.password } : {}) });
      } else {
        await call("/api/employees", "POST", f);
      }
      toast(user ? "Employee updated." : `${f.name} added. Share their login details with them.`);
      onClose();
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  async function remove() {
    if (!user) return;
    const ok = await ask({
      title: `Delete ${user.name}?`,
      message: "They'll be signed out and removed from the team. Their open leads and tasks become unassigned; past quotations and activity stay on record.",
      danger: true,
      confirmLabel: "Delete employee",
    });
    if (ok === null) return;
    setBusy(true);
    try {
      const data = await call(`/api/employees/${user.id}`, "DELETE");
      toast(data.message ?? "Employee deleted.");
      onClose();
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  const valid = f.name.trim() && (user || (/^\S+@\S+\.\S+$/.test(f.email) && f.password.length >= 8)) && (!f.password || f.password.length >= 8);
  return (
    <Modal open onClose={onClose} title={user ? "Edit employee" : "Add employee"} footer={<>{user && canDelete && !self && <button disabled={busy} onClick={remove} className={btn.danger} aria-label="Delete employee"><Trash2 size={15} /> Delete</button>}<button disabled={busy || !valid} onClick={save} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} {user ? "Save" : "Add employee"}</button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Full name *"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email (login) *"><input type="email" className={inputCls} value={f.email} onChange={set("email")} disabled={!!user} /></Field>
          <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
        </div>
        <Field label="Role" hint={role ? `Can give up to ${role.discount}% discount on quotations without approval.` : undefined}>
          <select className={inputCls} value={f.role} onChange={set("role")} disabled={self}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        </Field>
        {user && (
          <Field label="Status">
            <select className={inputCls} value={f.status} onChange={set("status")} disabled={self}>
              <option value="ACTIVE">Active — can sign in</option>
              <option value="INACTIVE">Inactive — signed out, can't sign in</option>
            </select>
          </Field>
        )}
        <Field label={user ? "Reset password" : "Temporary password *"} hint={user ? "At least 8 characters. Leave blank to keep the current password." : "At least 8 characters. Share it with them privately."}>
          <div className="relative">
            <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="text" autoComplete="new-password" className={inputCls + " pl-9"} value={f.password} onChange={set("password")} />
          </div>
        </Field>
      </div>
    </Modal>
  );
}
