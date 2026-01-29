import { useEffect, useRef, useState } from "react";
import type {
  PermissionResult,
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKUserMessage
} from "@anthropic-ai/claude-agent-sdk";
import type { StreamMessage, Attachment, FileChange } from "../types";
import type { PermissionRequest } from "../store/useAppStore";
import MDContent from "../render/markdown";
import { getPlatform } from "../platform";
import { DecisionPanel } from "./DecisionPanel";
import { ChangedFiles, type ChangedFile } from "./ChangedFiles";
import * as Dialog from "@radix-ui/react-dialog";

type MessageContent = SDKAssistantMessage["message"]["content"][number];
type ToolResultContent = SDKUserMessage["message"]["content"][number];
type ToolStatus = "pending" | "success" | "error";
const toolStatusMap = new Map<string, ToolStatus>();
const toolStatusListeners = new Set<() => void>();
const MAX_VISIBLE_LINES = 3;

type AskUserQuestionInput = {
  questions?: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
};

const getAskUserQuestionSignature = (input?: AskUserQuestionInput | null) => {
  if (!input?.questions?.length) return "";
  return input.questions.map((question) => {
    const options = (question.options ?? []).map((o) => `${o.label}|${o.description ?? ""}`).join(",");
    return `${question.question}|${question.header ?? ""}|${question.multiSelect ? "1" : "0"}|${options}`;
  }).join("||");
};

const setToolStatus = (toolUseId: string | undefined, status: ToolStatus) => {
  if (!toolUseId) return;
  toolStatusMap.set(toolUseId, status);
  toolStatusListeners.forEach((listener) => listener());
};

const useToolStatus = (toolUseId: string | undefined) => {
  const [status, setStatus] = useState<ToolStatus | undefined>(() =>
    toolUseId ? toolStatusMap.get(toolUseId) : undefined
  );
  useEffect(() => {
    if (!toolUseId) return;
    const handleUpdate = () => setStatus(toolStatusMap.get(toolUseId));
    toolStatusListeners.add(handleUpdate);
    return () => { toolStatusListeners.delete(handleUpdate); };
  }, [toolUseId]);
  return status;
};

const StatusDot = ({ variant = "accent", isActive = false, isVisible = true }: {
  variant?: "accent" | "success" | "error"; isActive?: boolean; isVisible?: boolean;
}) => {
  if (!isVisible) return null;
  const colorClass = variant === "success" ? "bg-success" : variant === "error" ? "bg-error" : "bg-accent";
  return (
    <span className="relative flex h-2 w-2">
      {isActive && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colorClass} opacity-75`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colorClass}`} />
    </span>
  );
};

// ChangedFilesPanel is now replaced by the ChangedFiles component from ./ChangedFiles.tsx

const SessionResult = ({ message, fileChanges, sessionId, onConfirmChanges, onRollbackChanges }: {
  message: SDKResultMessage;
  fileChanges?: FileChange[];
  sessionId?: string;
  onConfirmChanges?: (sessionId: string) => void;
  onRollbackChanges?: (sessionId: string) => void;
}) => {
  const formatMinutes = (ms: number | undefined) => typeof ms !== "number" ? "-" : `${(ms / 60000).toFixed(2)} min`;
  const formatUsd = (usd: number | undefined) => typeof usd !== "number" ? "-" : usd.toFixed(2);
  const formatMillions = (tokens: number | undefined) => typeof tokens !== "number" ? "-" : `${(tokens / 1_000_000).toFixed(3)}m`;

  // Always hide cost display - not relevant for local models and confusing for users
  const hasCost = false;

  // Convert FileChange[] to ChangedFile[] format
  const changedFiles: ChangedFile[] = (fileChanges || []).map(fc => ({
    file_path: fc.path,
    lines_added: fc.additions,
    lines_removed: fc.deletions,
    // FileChange currently only tracks path + line counts; no diff content available here.
    content_old: undefined,
    content_new: undefined,
  }));

  const handleViewDiff = (file: ChangedFile) => {
    // Open diff view for the file
    console.log('View diff for:', file.file_path);
    // TODO: Implement diff viewer modal or panel
  };

  const handleApply = () => {
    onConfirmChanges?.(sessionId!);
  };

  const handleReject = () => {
    onRollbackChanges?.(sessionId!);
  };

  return (
    <div className="flex flex-col gap-2 mt-4">
      <div className="header text-accent">Session Result</div>
      <div className="flex flex-col rounded-xl px-4 py-3 border border-ink-900/10 bg-surface-secondary space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="font-normal">Duration</span>
          <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2.5 py-0.5 text-ink-700 text-[13px]">{formatMinutes(message.duration_ms)}</span>
          <span className="font-normal">API</span>
          <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2.5 py-0.5 text-ink-700 text-[13px]">{formatMinutes(message.duration_api_ms)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="font-normal">Tokens</span>
          <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2.5 py-0.5 text-ink-700 text-[13px]">input:{formatMillions(message.usage?.input_tokens)}</span>
          <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2.5 py-0.5 text-ink-700 text-[13px]">output:{formatMillions(message.usage?.output_tokens)}</span>
          {hasCost && (
            <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-accent text-[13px]">
              ${formatUsd(message.total_cost_usd)}
            </span>
          )}
        </div>
      </div>
      {/* Always show changed files after Session Result using new ChangedFiles component */}
      <ChangedFiles
        files={changedFiles}
        onApply={fileChanges?.some(f => f.status === 'pending') ? handleApply : undefined}
        onReject={fileChanges?.some(f => f.status === 'pending') ? handleReject : undefined}
        onViewDiff={handleViewDiff}
      />
    </div>
  );
};

export function isMarkdown(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const patterns: RegExp[] = [/^#{1,6}\s+/m, /```[\s\S]*?```/];
  return patterns.some((pattern) => pattern.test(text));
}

function extractTagContent(input: string, tag: string): string | null {
  const match = input.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1] : null;
}

const ToolResult = ({ messageContent }: { messageContent: ToolResultContent }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const isFirstRender = useRef(true);
  let lines: string[] = [];
  
  if (messageContent.type !== "tool_result") return null;
  
  const toolUseId = messageContent.tool_use_id;
  const status: ToolStatus = messageContent.is_error ? "error" : "success";
  const isError = messageContent.is_error;

  const extractFilePaths = (text: string): string[] => {
    const paths = new Set<string>();
    const lines = String(text ?? "").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      const markers = ["Saved to:", "Output file:", "输出文件：", "输出文件:"];
      const marker = markers.find((m) => trimmed.includes(m));
      if (marker) {
        const idx = trimmed.indexOf(marker);
        const candidate = trimmed.slice(idx + marker.length).trim();
        if (candidate.startsWith("/")) paths.add(candidate);
        continue;
      }

      // Fallback: a line that looks like an absolute path
      if (trimmed.startsWith("/") && /\.[a-zA-Z0-9]{1,8}$/.test(trimmed)) {
        paths.add(trimmed);
      }
    }
    return Array.from(paths);
  };

  if (messageContent.is_error) {
    lines = [extractTagContent(String(messageContent.content), "tool_use_error") || String(messageContent.content)];
  } else {
    try {
      if (Array.isArray(messageContent.content)) {
        lines = messageContent.content.map((item: any) => item.text || "").join("\n").split("\n");
      } else {
        lines = String(messageContent.content).split("\n");
      }
    } catch { lines = [JSON.stringify(messageContent, null, 2)]; }
  }

  const isMarkdownContent = isMarkdown(lines.join("\n"));
  const hasMoreLines = lines.length > MAX_VISIBLE_LINES;
  const visibleContent = hasMoreLines && !isExpanded ? lines.slice(0, MAX_VISIBLE_LINES).join("\n") : lines.join("\n");
  const filePaths = extractFilePaths(lines.join("\n"));

  useEffect(() => { setToolStatus(toolUseId, status); }, [toolUseId, status]);
  useEffect(() => {
    if (!hasMoreLines || isFirstRender.current) { isFirstRender.current = false; return; }
    // Scroll to expanded content only when user explicitly expands it
    if (isExpanded) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [hasMoreLines, isExpanded]);

  return (
    <div className="flex flex-col mt-4 overflow-hidden">
      <div className="header text-accent">Output</div>
      <div className="mt-2 rounded-xl bg-surface-tertiary p-3 overflow-hidden">
        <pre className={`text-sm whitespace-pre-wrap break-words font-mono overflow-x-auto ${isError ? "text-red-500" : "text-ink-700"}`}>
          {isMarkdownContent ? <MDContent text={visibleContent} /> : visibleContent}
        </pre>
        {filePaths.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {filePaths.map((path) => (
              <div key={path} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 border border-ink-900/10">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted">File</div>
                  <div className="text-xs font-mono text-ink-700 truncate" title={path}>{path}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
                    onClick={() => getPlatform().send('open-file', path)}
                  >
                    Preview
                  </button>
                  <button
                    className="rounded-full border border-ink-900/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-tertiary transition-colors"
                    onClick={() => getPlatform().invoke('open-path-in-finder', path)}
                    title="Show in folder"
                  >
                    Save As
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {hasMoreLines && (
          <button onClick={() => setIsExpanded(!isExpanded)} className="mt-2 text-sm text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
            <span>{isExpanded ? "▲" : "▼"}</span>
            <span>{isExpanded ? "Collapse" : `Show ${lines.length - MAX_VISIBLE_LINES} more lines`}</span>
          </button>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

const AssistantBlockCard = ({ title, text, showIndicator = false, isTextBlock = false }: { title: string; text: string; showIndicator?: boolean; isTextBlock?: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex flex-col mt-4 overflow-hidden">
      <div className="header text-accent flex items-center gap-2">
        <StatusDot variant="success" isActive={showIndicator} isVisible={showIndicator} />
        {title}
      </div>
      <MDContent text={text} />
      {isTextBlock && (
        <button
          onClick={handleCopy}
          className="mt-2 self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-surface-tertiary text-ink-600 hover:bg-surface-secondary hover:text-accent transition-all duration-200"
          title="Copy response in Markdown format"
        >
          <svg className={`w-4 h-4 ${copied ? 'text-success' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {copied ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            )}
          </svg>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}
    </div>
  );
};

const ToolUseCard = ({ 
  messageContent, 
  showIndicator = false,
  permissionRequest,
  onPermissionResult
}: { 
  messageContent: MessageContent; 
  showIndicator?: boolean;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
}) => {
  if (messageContent.type !== "tool_use") return null;
  
  const toolStatus = useToolStatus(messageContent.id);
  const statusVariant = toolStatus === "error" ? "error" : "success";
  const isPending = !toolStatus || toolStatus === "pending";
  const shouldShowDot = toolStatus === "success" || toolStatus === "error" || showIndicator;
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (messageContent?.id && !toolStatusMap.has(messageContent.id)) setToolStatus(messageContent.id, "pending");
  }, [messageContent?.id]);

  const getToolInfo = (): string | null => {
    const input = messageContent.input as Record<string, any>;
    switch (messageContent.name) {
      case "Bash": case "run_command":
        return input?.command || input?.cmd || null;
      case "Read": case "read_file":
      case "Write": case "write_file":
      case "Edit": case "edit_file":
        return input?.file_path || null;
      case "Glob": case "search_files":
      case "Grep": case "search_text":
        return input?.pattern || null;
      case "Task":
        return input?.description || null;
      case "WebFetch": case "fetch": case "fetch_html": case "fetch_json":
        return input?.url || null;
      default: return null;
    }
  };

  const input = messageContent.input as Record<string, any>;
  const isCommandTool = messageContent.name === "run_command" || messageContent.name === "Bash";
  const commandText = isCommandTool ? (input?.command || input?.cmd || input?.args || "") : "";
  const canExpand = Boolean(isCommandTool && commandText);
  const toggleExpand = () => {
    if (!canExpand) return;
    setIsExpanded((prev) => !prev);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canExpand) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpand();
    }
  };

  // Check if this tool needs permission
  const isActiveRequest = permissionRequest && permissionRequest.toolUseId === messageContent.id;

  if (isActiveRequest && onPermissionResult) {
    return (
      <div className="mt-4">
        <DecisionPanel
          request={permissionRequest}
          onSubmit={(result) => onPermissionResult(permissionRequest.toolUseId, result)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-[1rem] bg-surface-tertiary px-3 py-2 mt-4 overflow-hidden ${canExpand ? "cursor-pointer" : ""}`}
      onClick={toggleExpand}
      onKeyDown={handleKeyDown}
      role={canExpand ? "button" : undefined}
      tabIndex={canExpand ? 0 : -1}
      aria-expanded={canExpand ? isExpanded : undefined}
    >
      <div className="flex flex-row items-center gap-2 min-w-0">
        <StatusDot variant={statusVariant} isActive={isPending && showIndicator} isVisible={shouldShowDot} />
        <div className="flex flex-row items-center gap-2 tool-use-item min-w-0 flex-1">
          <span className="inline-flex items-center rounded-md text-accent py-0.5 text-sm font-medium shrink-0">{messageContent.name}</span>
          <span className="text-sm text-muted truncate">{getToolInfo()}</span>
        </div>
        {canExpand && (
          <span className="text-xs text-muted shrink-0">{isExpanded ? "▲" : "▼"}</span>
        )}
      </div>
      {canExpand && isExpanded && (
        <pre className="mt-2 rounded-lg bg-ink-900/5 px-3 py-2 text-xs text-ink-700 whitespace-pre-wrap break-words overflow-auto">
          {String(commandText)}
        </pre>
      )}
    </div>
  );
};

const AskUserQuestionCard = ({
  messageContent,
  permissionRequest,
  onPermissionResult
}: {
  messageContent: MessageContent;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
}) => {
  if (messageContent.type !== "tool_use") return null;
  
  const input = messageContent.input as AskUserQuestionInput | null;
  const questions = input?.questions ?? [];
  const currentSignature = getAskUserQuestionSignature(input);
  const requestSignature = getAskUserQuestionSignature(permissionRequest?.input as AskUserQuestionInput | undefined);
  const isActiveRequest = permissionRequest && currentSignature === requestSignature;

  if (isActiveRequest && onPermissionResult) {
    return (
      <div className="mt-4">
        <DecisionPanel
          request={permissionRequest}
          onSubmit={(result) => onPermissionResult(permissionRequest.toolUseId, result)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[1rem] bg-surface-tertiary px-3 py-2 mt-4 overflow-hidden">
      <div className="flex flex-row items-center gap-2">
        <StatusDot variant="success" isActive={false} isVisible={true} />
        <span className="inline-flex items-center rounded-md text-accent py-0.5 text-sm font-medium">AskUserQuestion</span>
      </div>
      {questions.map((q, idx) => (
        <div key={idx} className="text-sm text-ink-700 ml-4">{q.question}</div>
      ))}
    </div>
  );
};

const SystemInfoCard = ({ message, showIndicator = false }: { message: SDKMessage; showIndicator?: boolean }) => {
  if (message.type !== "system" || !("subtype" in message)) return null;

  const systemMsg = message as any;

  if (systemMsg.subtype === "notice") {
    const noticeText = systemMsg.text || systemMsg.message || "System notice";
    return (
      <div className="flex flex-col gap-2">
        <div className="header text-accent flex items-center gap-2">
          <StatusDot variant="success" isActive={showIndicator} isVisible={showIndicator} />
          System Notice
        </div>
        <div className="rounded-xl px-4 py-2 border border-ink-900/10 bg-surface-secondary text-sm text-ink-700">
          {noticeText}
        </div>
      </div>
    );
  }

  if (systemMsg.subtype !== "init") return null;

  const InfoItem = ({ name, value }: { name: string; value: string }) => (
    <div className="text-[14px]">
      <span className="mr-4 font-normal">{name}</span>
      <span className="font-light">{value}</span>
    </div>
  );
  
  return (
    <div className="flex flex-col gap-2 overflow-hidden">
      <div className="header text-accent flex items-center gap-2">
        <StatusDot variant="success" isActive={showIndicator} isVisible={showIndicator} />
        System Init
      </div>
      <div className="flex flex-col rounded-xl px-4 py-2 border border-ink-900/10 bg-surface-secondary space-y-1">
        <InfoItem name="Session ID" value={systemMsg.session_id || "-"} />
        <InfoItem name="Model Name" value={systemMsg.model || "-"} />
        <InfoItem name="Permission Mode" value={systemMsg.permissionMode || "-"} />
        <InfoItem name="Working Directory" value={systemMsg.cwd || "-"} />
      </div>
    </div>
  );
};

// Image zoom modal component
const ImageZoomModal = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  imageName 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  imageUrl: string; 
  imageName: string;
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50 animate-in fade-in" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col">
            <Dialog.Close className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
            <img
              src={imageUrl}
              alt={imageName}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={onClose}
            />
            <div className="mt-2 text-center text-sm text-white/80 bg-black/50 px-4 py-2 rounded">
              {imageName}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// Attachment preview for displaying attached files in user messages
/** Renders attached media (image, video, audio) in user messages */
const AttachmentDisplay = ({ attachment }: { attachment: Attachment }) => {
  const [isZoomed, setIsZoomed] = useState(false);

  const toObjectUrl = (dataUrl: string, fallbackMimeType: string) => {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const rawMime = match[1];
    const mime = (!rawMime || rawMime === 'application/octet-stream')
      ? fallbackMimeType
      : (rawMime === 'audio/mp3' ? 'audio/mpeg' : rawMime);
    const base64 = match[2];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  };
  
  if (attachment.type === 'image') {
    return (
      <>
        <div className="mt-2">
          <img
            src={attachment.dataUrl}
            alt={`Attached image: ${attachment.name}`}
            className="max-w-xs max-h-48 rounded-lg object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
            onDoubleClick={() => setIsZoomed(true)}
            title="Double-click to zoom"
          />
          <div className="text-xs text-muted mt-1">{attachment.name}</div>
        </div>
        <ImageZoomModal
          isOpen={isZoomed}
          onClose={() => setIsZoomed(false)}
          imageUrl={attachment.dataUrl}
          imageName={attachment.name}
        />
      </>
    );
  }
  
  if (attachment.type === 'video') {
    const [videoError, setVideoError] = useState<string | null>(null);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
      try {
        const url = toObjectUrl(attachment.dataUrl, attachment.mimeType || 'video/mp4');
        setObjectUrl(url);
        return () => {
          if (url) URL.revokeObjectURL(url);
        };
      } catch {
        setObjectUrl(null);
        return;
      }
    }, [attachment.dataUrl, attachment.mimeType]);

    return (
      <div className="mt-2">
        {videoError ? (
          <div className="max-w-xs p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-700 mb-1">Failed to load video</div>
            <div className="text-xs text-red-600">{attachment.name}</div>
            <div className="text-xs text-red-500 mt-1">{videoError}</div>
          </div>
        ) : (
          <video
            src={objectUrl || attachment.dataUrl}
            controls
            className="max-w-xs max-h-48 rounded-lg"
            aria-label={`Video: ${attachment.name}`}
            onError={(e) => {
              const target = e.target as HTMLVideoElement;
              const error = target.error;
              let errorMsg = 'Unknown error';
              if (error) {
                switch (error.code) {
                  case MediaError.MEDIA_ERR_ABORTED:
                    errorMsg = 'Playback aborted';
                    break;
                  case MediaError.MEDIA_ERR_NETWORK:
                    errorMsg = 'Network error';
                    break;
                  case MediaError.MEDIA_ERR_DECODE:
                    errorMsg = 'Decoding error - unsupported format';
                    break;
                  case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMsg = 'Video format not supported by browser';
                    break;
                }
              }
              console.error('[VideoAttachment] Failed to load:', attachment.name, errorMsg);
              setVideoError(errorMsg);
            }}
          >
            <track kind="captions" />
            Your browser does not support the video element.
          </video>
        )}
        <div className="text-xs text-muted mt-1">{attachment.name}</div>
      </div>
    );
  }
  
  if (attachment.type === 'audio') {
    const [audioError, setAudioError] = useState<string | null>(null);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
      try {
        const url = toObjectUrl(attachment.dataUrl, attachment.mimeType || 'audio/mpeg');
        setObjectUrl(url);
        return () => {
          if (url) URL.revokeObjectURL(url);
        };
      } catch {
        setObjectUrl(null);
        return;
      }
    }, [attachment.dataUrl, attachment.mimeType]);

    return (
      <div className="mt-2">
        {audioError ? (
          <div className="max-w-xs p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-700 mb-1">Failed to load audio</div>
            <div className="text-xs text-red-600">{attachment.name}</div>
            <div className="text-xs text-red-500 mt-1">{audioError}</div>
          </div>
        ) : (
          <audio
            src={objectUrl || attachment.dataUrl}
            controls
            className="max-w-xs"
            aria-label={`Audio: ${attachment.name}`}
            onError={(e) => {
              const target = e.target as HTMLAudioElement;
              const error = target.error;
              let errorMsg = 'Unknown error';
              if (error) {
                switch (error.code) {
                  case MediaError.MEDIA_ERR_ABORTED:
                    errorMsg = 'Playback aborted';
                    break;
                  case MediaError.MEDIA_ERR_NETWORK:
                    errorMsg = 'Network error';
                    break;
                  case MediaError.MEDIA_ERR_DECODE:
                    errorMsg = 'Decoding error - unsupported format';
                    break;
                  case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMsg = 'Audio format not supported by browser';
                    break;
                }
              }
              console.error('[AudioAttachment] Failed to load:', attachment.name, errorMsg);
              setAudioError(errorMsg);
            }}
          >
            Your browser does not support the audio element.
          </audio>
        )}
        <div className="text-xs text-muted mt-1">{attachment.name}</div>
      </div>
    );
  }
  
  return null;
};

const UserMessageCard = ({ 
  message, 
  showIndicator = false,
  onEdit
}: { 
  message: { type: "user_prompt"; prompt: string; attachments?: Attachment[] }; 
  showIndicator?: boolean;
  onEdit?: (newPrompt: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.prompt);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSave = () => {
    if (editedText.trim() && onEdit) {
      onEdit(editedText.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedText(message.prompt);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col mt-4 group overflow-hidden">
      <div className="header text-accent flex items-center gap-2">
        <StatusDot variant="success" isActive={showIndicator} isVisible={showIndicator} />
        User
      </div>
      {isEditing ? (
        <div className="flex flex-col gap-2 mt-2">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full min-h-[100px] p-3 rounded-lg bg-surface-secondary border border-ink-900/10 focus:border-accent focus:outline-none resize-y max-w-full overflow-hidden"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Send
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-md bg-surface-tertiary hover:bg-surface-secondary text-ink-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <MDContent text={message.prompt} />
          {/* Display attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.attachments.map((attachment) => (
                <AttachmentDisplay key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 self-start">
            {onEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs px-3 py-1.5 rounded-md text-ink-400 hover:text-accent hover:bg-surface-tertiary opacity-0 group-hover:opacity-100 transition-all duration-200"
              >
                Edit
              </button>
            )}
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 rounded-md text-ink-400 hover:text-accent hover:bg-surface-tertiary opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1.5"
              title="Copy user message"
            >
              <svg className={`w-4 h-4 ${copied ? 'text-success' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {copied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                )}
              </svg>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export function MessageCard({
  message,
  isLast = false,
  isRunning = false,
  permissionRequest,
  onPermissionResult,
  onEditMessage,
  onRetry,
  messageIndex,
  fileChanges,
  sessionId,
  onConfirmChanges,
  onRollbackChanges
}: {
  message: StreamMessage;
  isLast?: boolean;
  isRunning?: boolean;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
  onEditMessage?: (messageIndex: number, newPrompt: string) => void;
  onRetry?: (prompt?: string) => void;
  messageIndex?: number;
  fileChanges?: FileChange[];
  sessionId?: string;
  onConfirmChanges?: (sessionId: string) => void;
  onRollbackChanges?: (sessionId: string) => void;
}) {
  const showIndicator = isLast && isRunning;

  if (message.type === "user_prompt") {
    return <UserMessageCard 
      message={message} 
      showIndicator={showIndicator}
      onEdit={onEditMessage && typeof messageIndex === 'number' 
        ? (newPrompt) => onEditMessage(messageIndex, newPrompt)
        : undefined
      }
    />;
  }

  const sdkMessage = message as SDKMessage;

  if (sdkMessage.type === "system") {
    return <SystemInfoCard message={sdkMessage} showIndicator={showIndicator} />;
  }

  if (sdkMessage.type === "result") {
    if (sdkMessage.subtype === "success") {
      return <SessionResult message={sdkMessage} fileChanges={fileChanges} sessionId={sessionId} onConfirmChanges={onConfirmChanges} onRollbackChanges={onRollbackChanges} />;
    }
    const retryable = Boolean((sdkMessage as any).retryable);
    const retryPrompt = (sdkMessage as any).retryPrompt || (sdkMessage as any).retry_prompt;
    const retryAttempts = (sdkMessage as any).retryAttempts;
    const canRetry = Boolean(onRetry && retryable && !isRunning);
    return (
      <div className="flex flex-col gap-2 mt-4">
        <div className="header text-error">Session Error</div>
        <div className="rounded-xl bg-error-light p-3">
          <pre className="text-sm text-error whitespace-pre-wrap">{JSON.stringify(sdkMessage, null, 2)}</pre>
          {retryAttempts ? (
            <div className="mt-2 text-xs text-error/80">Auto-retry failed after {retryAttempts} attempt{retryAttempts === 1 ? '' : 's'}.</div>
          ) : null}
          {canRetry ? (
            <button
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onRetry?.(retryPrompt)}
              disabled={!canRetry}
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (sdkMessage.type === "assistant") {
    const contents = sdkMessage.message.content;
    return (
      <>
        {contents.map((content: MessageContent, idx: number) => {
          const isLastContent = idx === contents.length - 1;
          if (content.type === "thinking") {
            return <AssistantBlockCard key={idx} title="Thinking" text={content.thinking} showIndicator={isLastContent && showIndicator} isTextBlock={false} />;
          }
          if (content.type === "text") {
            return <AssistantBlockCard key={idx} title="Assistant" text={content.text} showIndicator={isLastContent && showIndicator} isTextBlock={true} />;
          }
          if (content.type === "tool_use") {
            if (content.name === "AskUserQuestion") {
              return <AskUserQuestionCard key={idx} messageContent={content} permissionRequest={permissionRequest} onPermissionResult={onPermissionResult} />;
            }
            return <ToolUseCard key={idx} messageContent={content} showIndicator={isLastContent && showIndicator} permissionRequest={permissionRequest} onPermissionResult={onPermissionResult} />;
          }
          return null;
        })}
      </>
    );
  }

  if (sdkMessage.type === "user") {
    const contents = sdkMessage.message.content;
    return (
      <>
        {contents.map((content: ToolResultContent, idx: number) => {
          if (content.type === "tool_result") {
            return <ToolResult key={idx} messageContent={content} />;
          }
          return null;
        })}
      </>
    );
  }

  return null;
}

export { MessageCard as EventCard };
