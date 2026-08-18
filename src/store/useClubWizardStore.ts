import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AdminInvite {
  email: string;
  role: "co-president" | "vice-president" | "treasurer" | "secretary" | "officer";
}

export interface ClubWizardFormState {
  name: string;
  slug: string;
  category_id: string | null;
  visibility: "public" | "private" | "unlisted";
  description: string;
  github_repo_url: string;
  logo_url: string;
  social_links: Record<string, string>;
  admin_invites: AdminInvite[];
  tags?: string[];
}

const defaultWizardValues: ClubWizardFormState = {
  name: "",
  slug: "",
  category_id: null,
  visibility: "public",
  description: "",
  github_repo_url: "",
  logo_url: "",
  social_links: {},
  admin_invites: [],
  tags: [],
};

export interface ClubWizardStore {
  formData: ClubWizardFormState;
  updateFormData: (partial: Partial<ClubWizardFormState>) => void;
  addAdminInvite: (invite: AdminInvite) => void;
  removeAdminInvite: (index: number) => void;
  resetWizard: () => void;
}

export const useClubWizardStore = create<ClubWizardStore>()(
  persist(
    (set) => ({
      formData: defaultWizardValues,
      updateFormData: (partial) =>
        set((state) => ({
          formData: { ...state.formData, ...partial },
        })),
      addAdminInvite: (invite) =>
        set((state) => ({
          formData: {
            ...state.formData,
            admin_invites: [...state.formData.admin_invites, invite],
          },
        })),
      removeAdminInvite: (index) =>
        set((state) => ({
          formData: {
            ...state.formData,
            admin_invites: state.formData.admin_invites.filter((_, i) => i !== index),
          },
        })),
      resetWizard: () => set({ formData: defaultWizardValues }),
    }),
    {
      name: "campusconnect.club-wizard-store",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
