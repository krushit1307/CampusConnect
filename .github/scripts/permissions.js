import { MAINTAINER_ASSOCIATIONS } from "./constants.js";
import { getCollaboratorPermission } from "./helpers.js";

export function issueAuthorRole(issue) {
  const association = String(issue?.author_association || "").toUpperCase();
  if (association === "OWNER") return "owner";
  if (association === "MEMBER") return "maintainer";
  if (association === "COLLABORATOR") return "collaborator";
  return "external";
}

export function actorRoleFromPermission(permissionLevel) {
  if (permissionLevel === "admin") return "owner";
  if (permissionLevel === "maintain" || permissionLevel === "write") return "maintainer";
  if (permissionLevel === "triage") return "collaborator";
  if (permissionLevel === "read") return "contributor";
  return "external";
}

export function isMaintainerAssociation(association) {
  return MAINTAINER_ASSOCIATIONS.includes(String(association || "").toUpperCase());
}

export async function resolveActorRole(github, context, core, actor) {
  if (actor === context.repo.owner) return "owner";
  const permission = await getCollaboratorPermission(github, context, core, actor);
  return actorRoleFromPermission(permission);
}

export function canAutoClaimIssue(issue, actor) {
  const authorRole = issueAuthorRole(issue);
  const issueAuthor = issue?.user?.login;
  if (["owner", "maintainer", "collaborator"].includes(authorRole)) return true;
  return issueAuthor === actor;
}

export function isMaintainerRole(role) {
  return role === "owner" || role === "maintainer" || role === "collaborator";
}

export function canUnclaim(actor, actorRole, currentAssignee) {
  if (actor === currentAssignee) return true;
  return isMaintainerRole(actorRole);
}
