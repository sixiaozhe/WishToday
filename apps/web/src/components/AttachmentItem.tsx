import { useEffect, useState } from 'react';
import { Download, Paperclip, X } from 'lucide-react';
import type { AttachmentMeta } from '@dayline/core';
import { resolveAttachmentUrl } from '../attachments';

interface AttachmentItemProps {
  attachment: AttachmentMeta;
  onDelete: (attachmentId: string) => void;
}

export function AttachmentItem({ attachment, onDelete }: AttachmentItemProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void resolveAttachmentUrl(attachment.storagePath)
      .then((resolved) => {
        if (cancelled) {
          if (resolved?.startsWith('blob:')) URL.revokeObjectURL(resolved);
          return;
        }
        objectUrl = resolved;
        setUrl(resolved);
        setMissing(resolved === null);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.storagePath]);

  const isImage = attachment.mimeType.startsWith('image/') && url && !missing;

  return (
    <div className="attachment-row">
      {isImage ? (
        <img src={url} alt={attachment.fileName} />
      ) : (
        <Paperclip size={15} />
      )}
      {url ? (
        <a href={url} download={attachment.fileName}>
          {attachment.fileName}
        </a>
      ) : (
        <span className={missing ? 'attachment-missing' : ''}>
          {missing ? `${attachment.fileName}（文件缺失）` : attachment.fileName}
        </span>
      )}
      <em>{Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB</em>
      {url && (
        <a
          className="icon-button tiny"
          href={url}
          download={attachment.fileName}
          aria-label={`下载附件${attachment.fileName}`}
          title="下载"
        >
          <Download size={12} />
        </a>
      )}
      <button
        className="icon-button tiny"
        onClick={() => onDelete(attachment.id)}
        aria-label={`删除附件${attachment.fileName}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}
