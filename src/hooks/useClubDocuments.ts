import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface ClubFolder {
  id: string;
  club_id: string;
  parent_id: string | null;
  name: string;
  order_index: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClubDocument {
  id: string;
  club_id: string;
  folder_id: string | null;
  name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  order_index: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FolderTreeNode extends ClubFolder {
  children: FolderTreeNode[];
  documents: ClubDocument[];
}

export function useClubDocuments(clubId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const foldersQuery = useQuery<ClubFolder[]>({
    queryKey: ["club-folders", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_folders")
        .select("*")
        .eq("club_id", clubId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clubId,
  });

  const documentsQuery = useQuery<ClubDocument[]>({
    queryKey: ["club-documents", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_documents")
        .select("*")
        .eq("club_id", clubId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clubId,
  });

  const buildTree = (): FolderTreeNode[] => {
    const folders = foldersQuery.data ?? [];
    const documents = documentsQuery.data ?? [];
    const folderMap = new Map<string, FolderTreeNode>();

    for (const f of folders) {
      folderMap.set(f.id, { ...f, children: [], documents: [] });
    }

    const roots: FolderTreeNode[] = [];
    for (const node of folderMap.values()) {
      if (node.parent_id && folderMap.has(node.parent_id)) {
        folderMap.get(node.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    for (const doc of documents) {
      const parent = doc.folder_id ? folderMap.get(doc.folder_id) : null;
      if (parent) {
        parent.documents.push(doc);
      }
    }

    return roots;
  };

  const createFolder = useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId?: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("club_folders")
        .insert({
          club_id: clubId,
          parent_id: parentId ?? null,
          name,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-folders", clubId] });
      toast.success("Folder created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameFolder = useMutation({
    mutationFn: async ({ folderId, name }: { folderId: string; name: string }) => {
      const { error } = await supabase.from("club_folders").update({ name }).eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-folders", clubId] });
      toast.success("Folder renamed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase.from("club_folders").delete().eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-folders", clubId] });
      queryClient.invalidateQueries({ queryKey: ["club-documents", clubId] });
      toast.success("Folder deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const moveFolder = useMutation({
    mutationFn: async ({
      folderId,
      parentId,
      orderIndex,
    }: {
      folderId: string;
      parentId: string | null;
      orderIndex: number;
    }) => {
      const { error } = await supabase
        .from("club_folders")
        .update({ parent_id: parentId, order_index: orderIndex })
        .eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-folders", clubId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      folderId,
      onProgress,
    }: {
      file: File;
      folderId?: string | null;
      onProgress?: (percent: number) => void;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const storagePath = folderId
        ? `${clubId}/${folderId}/${file.name}`
        : `${clubId}/root/${file.name}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("club-documents")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("club-documents").getPublicUrl(storagePath);

      const { data, error } = await supabase
        .from("club_documents")
        .insert({
          club_id: clubId,
          folder_id: folderId ?? null,
          name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          created_by: user.id,
        })
        .select()
        .single();
      if (error) {
        await supabase.storage.from("club-documents").remove([storagePath]);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-documents", clubId] });
      toast.success("Document uploaded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteDocument = useMutation({
    mutationFn: async (document: ClubDocument) => {
      const storagePath = document.folder_id
        ? `${clubId}/${document.folder_id}/${document.name}`
        : `${clubId}/root/${document.name}`;

      await supabase.storage.from("club-documents").remove([storagePath]);

      const { error } = await supabase.from("club_documents").delete().eq("id", document.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-documents", clubId] });
      toast.success("Document deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    folders: foldersQuery.data ?? [],
    documents: documentsQuery.data ?? [],
    tree: buildTree(),
    isLoading: foldersQuery.isLoading || documentsQuery.isLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    uploadDocument,
    deleteDocument,
  };
}
