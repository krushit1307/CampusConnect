export function generateVCard(user: { full_name: string; email: string }): string {
  const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${user.full_name}
N:${user.full_name.split(" ").reverse().join(";")};;;
EMAIL;TYPE=INTERNET:${user.email}
END:VCARD`;
  return vcard;
}

export function downloadVCard(user: { full_name: string; email: string }) {
  const vcard = generateVCard(user);
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${user.full_name.replace(/\\s+/g, "_")}.vcf`);
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
