import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { withAuth } from "@/hoc/withAuth";
import { Helmet } from "react-helmet-async";

/**
 * Route page for viewing system audit logs.
 * Protected by withAuth HOC to ensure only admins can access.
 */
function AdminAuditLogsPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Helmet>
        <title>Audit Logs | CampusConnect Admin</title>
        <meta name="description" content="View tamper-proof database mutation logs." />
      </Helmet>

      <header className="mb-8">
        <h1 className="font-mono text-3xl font-bold uppercase tracking-tight md:text-4xl">
          Audit Logs
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          View a tamper-proof history of all critical database mutations (inserts, updates, deletes)
          across events, clubs, and club memberships.
        </p>
      </header>

      <AuditLogViewer />
    </div>
  );
}

// Wrap with auth HOC, requiring club_admin or higher role
export default withAuth(AdminAuditLogsPage);
