import React from "react";
import { SplitPane } from "@/components/SplitPane";
import { AdminSidebar } from "@/components/AdminSidebar"; // Assuming this exists
import { Outlet } from "react-router-dom";
import AssetCheckoutScanner from "@/components/AssetCheckoutScanner"; // <-- Scanner Import Added Here

/**
 * AdminLayout
 *
 * Wraps the admin dashboard routes with the draggable SplitPane component.
 * This allows club admins to dynamically resize the navigation sidebar to
 * maximize screen real estate for complex data tables.
 */
export const AdminLayout: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Optional: Admin Header/Navbar could go here */}

      <div className="flex-1 overflow-hidden">
        <SplitPane
          sidebar={<AdminSidebar />}
          mainContent={
            <div className="h-full p-6 overflow-y-auto">
              
              {/* --- TEMPORARY SCANNER MOUNT FOR TESTING --- */}
              <div className="mb-8 border-b-2 border-gray-200 pb-8">
                <AssetCheckoutScanner />
              </div>
              {/* ------------------------------------------- */}

              <Outlet />
            </div>
          }
          minSidebarWidth={200}
          maxSidebarWidth={500}
          defaultSidebarWidth={280}
          storageKey="campusconnect-admin-sidebar-width"
        />
      </div>
    </div>
  );
};

export default AdminLayout;
