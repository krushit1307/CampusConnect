import format from "date-fns/format";
import { Loader2 } from "lucide-react";
import { getFileIcon, formatBytes, VaultFileActions } from "./VaultFileGrid";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function VaultListView({
  files,
  loading,
  onFileChanged,
}: {
  files: any[];
  loading: boolean;
  onFileChanged: () => void;
}) {
  if (loading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (files.length === 0)
    return (
      <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg bg-card mt-4">
        No files found in this folder.
      </div>
    );

  return (
    <div className="bg-card border rounded-lg overflow-hidden mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>File Name</TableHead>
            <TableHead>Uploaded By</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Size</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id} className="group">
              <TableCell>
                <div className="w-8 h-8 flex items-center justify-center transform scale-75">
                  {getFileIcon(file.mime_type)}
                </div>
              </TableCell>
              <TableCell className="font-medium">{file.file_name}</TableCell>
              <TableCell className="text-muted-foreground">
                {file.profiles?.first_name} {file.profiles?.last_name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(file.uploaded_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatBytes(file.file_size)}</TableCell>
              <TableCell>
                <VaultFileActions file={file} onFileChanged={onFileChanged} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
