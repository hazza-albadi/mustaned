"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/config";
import {
  ALLOWED_FILE_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES,
} from "@/lib/form-fields";
import type { SubmissionFile } from "@/types";
import { File as FileIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  done: boolean;
}

export function FileUpload({
  userId,
  draftId,
  value,
  onChange,
}: {
  userId: string;
  draftId: string;
  value: SubmissionFile[];
  onChange: (files: SubmissionFile[]) => void;
}) {
  const { t } = useI18n();
  const supabase = createClient();
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (value.length + accepted.length > MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      for (const file of accepted) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error(`${file.name} exceeds the 5MB limit`);
          continue;
        }

        const tempId = `${file.name}-${Date.now()}`;
        setUploading((prev) => [...prev, { id: tempId, name: file.name, progress: 10, done: false }]);

        const path = `submissions/${draftId}/${userId}/${Date.now()}-${file.name}`;

        const { error } = await supabase.storage.from("form-files").upload(path, file, {
          upsert: false,
        });

        if (error) {
          toast.error(`Failed to upload ${file.name}`);
          setUploading((prev) => prev.filter((f) => f.id !== tempId));
          continue;
        }

        const { data: urlData } = await supabase.storage.from("form-files").createSignedUrl(path, 60 * 60 * 24 * 365);

        setUploading((prev) => prev.filter((f) => f.id !== tempId));
        onChange([
          ...value,
          {
            name: file.name,
            url: urlData?.signedUrl ?? path,
            size: file.size,
            type: file.type,
          },
        ]);
      }
    },
    [value, onChange, draftId, userId, supabase]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_FILE_MIME_TYPES,
    maxSize: MAX_FILE_SIZE_BYTES,
    disabled: value.length >= MAX_FILES,
  });

  const removeFile = (name: string) => {
    onChange(value.filter((f) => f.name !== name));
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        } ${value.length >= MAX_FILES ? "pointer-events-none opacity-50" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">{t("common.dragDropFiles")}</p>
        <p className="text-xs text-muted-foreground">{t("common.maxFileSize")}</p>
      </div>

      {uploading.map((f) => (
        <div key={f.id} className="flex items-center gap-2 text-sm">
          <FileIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{f.name}</span>
          <Progress value={f.progress} className="w-24" />
        </div>
      ))}

      {value.map((f) => (
        <div key={f.name} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <FileIcon className="h-4 w-4 shrink-0" />
          <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline">
            {f.name}
          </a>
          <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(f.name)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
