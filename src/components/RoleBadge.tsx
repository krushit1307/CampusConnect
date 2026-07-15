type Role = "admin" | "organizer" | "member" | "alumni";

const variantMap: Record<Role, string> = {
  admin: "bg-peach border-black text-black",
  organizer: "bg-lavender border-black text-black",
  member: "bg-sky border-black text-black",
  alumni: "bg-lime border-black text-black",
};

const labelMap: Record<Role, string> = {
  admin: "Admin",
  organizer: "Organizer",
  member: "Member",
  alumni: "Alumni",
};

export function RoleBadge({ role }: { role: Role }) {
  const styles = variantMap[role] ?? variantMap.member;
  const label = labelMap[role] ?? role;

  return (
    <span
      className={`inline-block border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none ${styles}`}
    >
      {label}
    </span>
  );
}
